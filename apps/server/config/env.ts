/**
 * Reading the environment.
 *
 * Every reader here returns a *value* — the setting, or `undefined` for "this
 * deployment did not configure it". Nothing returns a fragment of an object, so
 * nothing has to be spread conditionally at the call site; `when` and `defined`
 * are what a caller reaches for instead.
 *
 * These are the only functions in `config/` that touch `process.env` directly.
 * A builder that needs a setting asks for it through one of them, which is what
 * keeps "how is an empty value read", "what counts as a number" and "what does a
 * missing value mean" answered once for the whole app.
 */

/**
 * Reads a deploy value the server cannot run without, failing at load rather
 * than several seconds into boot.
 *
 * Left to default to `''`, a missing `DATABASE_URL` reaches `pg` as "use the
 * libpq defaults", and the first thing that touches the database — identity's
 * role seeder, during `onApplicationBootstrap` — fails with whatever the local
 * libpq environment happens to produce (measured: `SASL:
 * SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`). The server
 * does fail closed, which is the important half, but nothing in that message
 * names the variable that was never set.
 */
export function requireEnv(name: string): string {
    const raw = readEnv(name);
    if (!raw) {
        throw new Error(
            `Missing required environment variable ${name}. ` +
                'Copy `.env.example` to `.env` and set it (see `README.md`); ' +
                'the server has no usable default for this value.'
        );
    }
    return raw;
}

/**
 * A trimmed environment value, `undefined` when unset **or empty**.
 *
 * The empty case matters: `.env.example` ships several keys with no value, so
 * `KEY=` has to read the same as "not configured" — otherwise a fresh clone
 * boots with an empty API key rather than without a provider.
 */
export function readEnv(name: string): string | undefined {
    return process.env[name]?.trim() || undefined;
}

/**
 * Reads a numeric setting: the default when unset or empty, the value when it is
 * a plain positive decimal integer, and an error otherwise.
 *
 * This replaces `Number(process.env[x]) || default`, which was wrong in three
 * directions at once and silent in all of them. `0` is falsy, so it became the
 * default — `LOGIN_RATE_LIMIT=0` ("block every login") quietly meant 10. A
 * negative is truthy, so it was accepted — `SESSION_TTL_SECONDS=-1` issued every
 * session already expired, login answering `201` and the very next request
 * `401`. And exponent notation parsed, so `GRAPHQL_MAX_DEPTH=1e9` removed the
 * cost budget that ADR-0008 calls GraphQL's replacement for REST's structural
 * bound. Refusing to boot names the variable; the alternative was a deployment
 * that looked configured and was not.
 *
 * Empty is deliberately *not* an error: `.env.example` ships several keys with
 * no value, and a fresh clone must boot from it unchanged.
 */
export function readPositiveInt(name: string, fallback: number): number {
    return readOptionalPositiveInt(name) ?? fallback;
}

/** As {@link readPositiveInt}, but `undefined` when unset — no default to fall back to. */
export function readOptionalPositiveInt(name: string): number | undefined {
    const raw = readEnv(name);
    if (!raw) {
        return undefined;
    }
    // Plain decimal digits only. `Number` would also take `1e9`, `0x20` and
    // `Infinity`, none of which anyone means to write in a `.env`.
    if (!/^\d+$/.test(raw) || Number(raw) <= 0) {
        throw new Error(
            `Environment variable ${name} must be a positive whole number ` +
                `(got "${raw}").`
        );
    }
    return Number(raw);
}

/** A comma-separated list setting, trimmed and emptied of blanks. */
export function readList(name: string, fallback: string): string[] {
    return (process.env[name] ?? fallback)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

/**
 * As {@link readList}, but `undefined` when the variable is unset, so the
 * consumer's own default list survives rather than being replaced by an empty
 * one.
 */
export function readOptionalList(name: string): string[] | undefined {
    return when(readEnv(name), () => readList(name, ''));
}

/**
 * A boolean setting: what the deployment said, or `fallback` when it said
 * nothing. Anything other than `true` reads as false, so a typo turns a switch
 * off rather than on.
 */
export function readFlag(name: string, fallback: boolean): boolean {
    const raw = readEnv(name);
    return raw === undefined ? fallback : raw === 'true';
}

/**
 * The value when the setting was configured, `undefined` when it was not.
 *
 * The counterpart to {@link defined}: together they replace
 * `...(x ? { key: … } : {})`. `build` is a thunk so the body — often several
 * further reads — runs only when it applies.
 */
export function when<T>(configured: unknown, build: () => T): T | undefined {
    return configured ? build() : undefined;
}

/**
 * The same object with every `undefined`-valued key removed.
 *
 * Plugins merge their defaults as `{ ...DEFAULTS, ...config }`, so an explicit
 * `{ maxSteps: undefined }` does not leave `DEFAULT_RUN_LIMITS.maxSteps` in
 * place — it erases it. That, and not the type checker, is what the conditional
 * spreads were guarding against; this says it once, at the end of a builder,
 * instead of once per key in the middle of one.
 */
export function defined<T extends object>(value: T): T {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
        if (item !== undefined) {
            result[key] = item;
        }
    }
    return result as T;
}

/** The deployment modes this app recognises. */
const NODE_ENVS = ['development', 'test', 'production'] as const;

/**
 * Reads `NODE_ENV`, rejecting a value that is neither recognised nor empty.
 *
 * `NODE_ENV !== 'production'` is the switch behind **two** protections at once —
 * whether the API reference and GraphiQL are published, and whether the session
 * cookie carries `Secure` — so any value that is not exactly `production` turns
 * both off. Unset is a legitimate, and the common, local state; a *typo* is not,
 * and it is indistinguishable from correct configuration until you read a
 * `Set-Cookie` header. Measured on this app: `NODE_ENV=produciton` serves
 * `/reference/json` to an unauthenticated caller and drops `Secure` from the
 * session cookie, exactly as if nothing had been set (ORT-137).
 *
 * Rejecting the typo costs a deployment that spells it right nothing, and turns
 * a silent downgrade into a refusal to start.
 */
function readNodeEnv(): (typeof NODE_ENVS)[number] | undefined {
    const raw = readEnv('NODE_ENV');
    if (!raw) {
        return undefined;
    }
    if (!(NODE_ENVS as readonly string[]).includes(raw)) {
        throw new Error(
            `NODE_ENV is "${raw}", which this app does not recognise — expected ` +
                `one of ${NODE_ENVS.join(', ')}, or nothing at all for local ` +
                'development. Anything else reads as "not production", which ' +
                'publishes the API reference and drops `Secure` from the session ' +
                'cookie.'
        );
    }
    return raw as (typeof NODE_ENVS)[number];
}

/** True only in a deployment that said so, with the spelling checked. */
export const isProduction = readNodeEnv() === 'production';
