import type { OrthaConfig } from '../ortha.config';

/**
 * The host config, exercised through the real module.
 *
 * Every value here is read at **import** time from `process.env`, so the only
 * honest way to test it is to set the environment and re-import — which is what
 * `loadConfig` below does. The alternative (a second copy of the reading logic
 * in a spec) is the shape that let `apps/server-e2e` stay green through four of
 * the five findings on `bootstrap-server`: it asserted a mirror of the
 * bootstrap rather than the bootstrap.
 *
 * The claims are worth pinning because the failure mode of this file is silence.
 * `Number(process.env[x]) || default` accepted a negative and swallowed a zero,
 * and `NODE_ENV !== 'production'` reads a misspelling as "not production" —
 * neither is visible from the outside until a session expires on arrival or a
 * cookie ships without `Secure`.
 *
 * Lives under `src/` because that is what `tsconfig.spec.json` compiles; the
 * module under test is one level up.
 */

/** Reloads `ortha.config` with `env` applied over the ambient environment. */
function loadConfig(env: Record<string, string | undefined>): OrthaConfig {
    const saved = { ...process.env };
    for (const [key, value] of Object.entries(env)) {
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
    try {
        let loaded: OrthaConfig | undefined;
        jest.isolateModules(() => {
            loaded = require('../ortha.config').default as OrthaConfig;
        });
        return loaded as OrthaConfig;
    } finally {
        process.env = saved;
    }
}

/** Loads with `env` applied and returns the thrown error's message, or `null`. */
function loadError(env: Record<string, string | undefined>): string | null {
    try {
        loadConfig(env);
        return null;
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

describe('required deploy values', () => {
    it('refuses to load without DATABASE_URL, naming the variable', () => {
        const message = loadError({ DATABASE_URL: undefined });
        expect(message).toContain('DATABASE_URL');
    });

    it('treats an empty DATABASE_URL as missing rather than as a connection string', () => {
        // `pg` reads `''` as "use the libpq defaults", so this used to boot and
        // then fail inside identity's role seeder on an error about SASL.
        expect(loadError({ DATABASE_URL: '   ' })).toContain('DATABASE_URL');
    });
});

describe('numeric settings', () => {
    it('falls back to the default when unset or empty', () => {
        // `.env.example` ships several keys with no value on the right-hand side,
        // so empty has to mean "not configured", not "configured badly".
        expect(loadConfig({ SESSION_TTL_SECONDS: undefined }).plugins.identity
            .session.ttlSeconds).toBe(60 * 60 * 24 * 7);
        expect(loadConfig({ SESSION_TTL_SECONDS: '' }).plugins.identity.session
            .ttlSeconds).toBe(60 * 60 * 24 * 7);
    });

    it('reads a plain positive integer', () => {
        expect(
            loadConfig({ SESSION_TTL_SECONDS: '3600' }).plugins.identity.session
                .ttlSeconds
        ).toBe(3600);
    });

    it('rejects a negative value instead of accepting it', () => {
        // Measured before this check existed: `SESSION_TTL_SECONDS=-1` boots,
        // login answers `201` with `Max-Age=-1`, and the next request is `401` —
        // an instance where nobody can stay signed in and nothing says why.
        expect(loadError({ SESSION_TTL_SECONDS: '-1' })).toContain(
            'SESSION_TTL_SECONDS'
        );
        expect(loadError({ MEDIA_MAX_UPLOAD_BYTES: '-1' })).toContain(
            'positive whole number'
        );
    });

    it('rejects zero instead of silently substituting the default', () => {
        // `LOGIN_RATE_LIMIT=0` reads as "allow no logins" and used to mean 10.
        expect(loadError({ LOGIN_RATE_LIMIT: '0' })).toContain(
            'LOGIN_RATE_LIMIT'
        );
    });

    it('rejects exponent notation, which quietly removed the GraphQL cost budget', () => {
        // `Number('1e9')` is a finite integer, so `GRAPHQL_MAX_DEPTH=1e9` passed
        // every check and deleted the bound ADR-0008 relies on in place of the
        // structural one REST gave for free.
        expect(loadError({ GRAPHQL_MAX_DEPTH: '1e9' })).toContain(
            'GRAPHQL_MAX_DEPTH'
        );
    });

    it('rejects a non-numeric value', () => {
        expect(loadError({ PORT: 'eight-thousand' })).toContain('PORT');
    });
});

describe('NODE_ENV', () => {
    it('publishes the API reference and omits Secure when unset (local development)', () => {
        const config = loadConfig({ NODE_ENV: undefined, API_DOCS: undefined });
        expect(config.docs.enabled).toBe(true);
        expect(config.plugins.identity.session.cookieSecure).toBe(false);
    });

    it('withholds the reference and sets Secure in production', () => {
        const config = loadConfig({
            NODE_ENV: 'production',
            API_DOCS: undefined
        });
        expect(config.docs.enabled).toBe(false);
        expect(config.plugins.identity.session.cookieSecure).toBe(true);
    });

    it('refuses a misspelling rather than reading it as "not production"', () => {
        // The whole of ORT-137 in one line: `produciton` served
        // `/reference/json` unauthenticated *and* dropped `Secure` from the
        // session cookie, indistinguishable from a correct configuration until
        // someone read a response header.
        const message = loadError({ NODE_ENV: 'produciton' });
        expect(message).toContain('produciton');
        expect(message).toContain('production');
    });

    it('lets API_DOCS override in both directions', () => {
        expect(
            loadConfig({ NODE_ENV: 'production', API_DOCS: 'true' }).docs.enabled
        ).toBe(true);
        expect(
            loadConfig({ NODE_ENV: undefined, API_DOCS: 'false' }).docs.enabled
        ).toBe(false);
        // Fail-closed on any other spelling, which is the right way round.
        expect(
            loadConfig({ NODE_ENV: undefined, API_DOCS: 'TRUE' }).docs.enabled
        ).toBe(false);
    });
});

describe('copilot run ceilings', () => {
    const unset = {
        COPILOT_MAX_STEPS: undefined,
        COPILOT_WALL_CLOCK_MS: undefined,
        COPILOT_MAX_TOTAL_TOKENS: undefined
    };

    it('omits `limits` entirely when none are set', () => {
        // Spreading `limits: { maxSteps: undefined }` would overwrite the
        // plugin's own ceiling with nothing, so each key is conditional — and
        // so is the object, or an untouched `.env` would pin `limits: {}` here
        // instead of leaving DEFAULT_RUN_LIMITS visible.
        expect(loadConfig(unset).plugins.copilot.limits).toBeUndefined();
        expect(
            loadConfig({
                ...unset,
                COPILOT_MAX_STEPS: '',
                COPILOT_WALL_CLOCK_MS: '',
                COPILOT_MAX_TOTAL_TOKENS: ''
            }).plugins.copilot.limits
        ).toBeUndefined();
    });

    it('passes each configured ceiling through on its own', () => {
        expect(
            loadConfig({ ...unset, COPILOT_MAX_STEPS: '20' }).plugins.copilot
                .limits
        ).toEqual({ maxSteps: 20 });
        expect(
            loadConfig({ ...unset, COPILOT_WALL_CLOCK_MS: '600000' }).plugins
                .copilot.limits
        ).toEqual({ wallClockMs: 600_000 });
        expect(
            loadConfig({ ...unset, COPILOT_MAX_TOTAL_TOKENS: '900000' }).plugins
                .copilot.limits
        ).toEqual({ maxTotalTokens: 900_000 });
    });

    it('carries a partial override without inventing the other two', () => {
        // The point of the conditional keys: raising one must not silently pin
        // the other two to whatever this file happened to think they were.
        expect(
            loadConfig({
                ...unset,
                COPILOT_MAX_STEPS: '50',
                COPILOT_MAX_TOTAL_TOKENS: '900000'
            }).plugins.copilot.limits
        ).toEqual({ maxSteps: 50, maxTotalTokens: 900_000 });
    });

    it('rejects zero, which would make every run end before its first step', () => {
        expect(loadError({ ...unset, COPILOT_MAX_STEPS: '0' })).toContain(
            'COPILOT_MAX_STEPS'
        );
        expect(loadError({ ...unset, COPILOT_WALL_CLOCK_MS: '0' })).toContain(
            'COPILOT_WALL_CLOCK_MS'
        );
        expect(
            loadError({ ...unset, COPILOT_MAX_TOTAL_TOKENS: '0' })
        ).toContain('COPILOT_MAX_TOTAL_TOKENS');
    });
});

describe('ALLOWED_ORIGINS', () => {
    it('trims and drops empties', () => {
        expect(
            loadConfig({
                ALLOWED_ORIGINS: ' http://a.test , ,http://b.test '
            }).plugins.identity.allowedOrigins
        ).toEqual(['http://a.test', 'http://b.test']);
    });

    it('follows ADMIN_PORT when unset, so a parallel worktree stack is not rejected', () => {
        expect(
            loadConfig({ ALLOWED_ORIGINS: undefined, ADMIN_PORT: '4207' })
                .plugins.identity.allowedOrigins
        ).toEqual(['http://localhost:4207']);
    });

    it('yields an empty list when set to empty, refusing every browser origin', () => {
        // Fail-closed, and worth pinning as deliberate: an operator who blanks
        // the variable locks the admin out of every state-changing request
        // (measured: `403` from the OriginGuard on login), with a `.env` that
        // looks configured.
        expect(
            loadConfig({ ALLOWED_ORIGINS: '' }).plugins.identity.allowedOrigins
        ).toEqual([]);
    });
});

/**
 * Which model backends this deployment even has.
 *
 * There is no `COPILOT_PROVIDER` naming one of them any more: the registered
 * list is the setting and its first entry serves a run that names none, so a
 * backend nobody configured must not be in the list at all — registered, it
 * would be the house default and would fail on the first message.
 */
describe('copilot provider registration', () => {
    const unset = {
        ANTHROPIC_API_KEY: undefined,
        COPILOT_OPENAI_BASE_URL: undefined
    };

    it('registers neither hosted backend in a clone with no keys', () => {
        // Which leaves the catalogue empty: `plugins.ts` adds no scripted
        // fallback, so a keyless clone has no copilot at all. `COPILOT_ENABLED`
        // is off by default, so that boots; enabling it without configuring a
        // backend fails at construction instead.
        expect(loadConfig(unset).plugins.copilot.providers).toEqual({});
    });

    it('adds Claude when, and only when, a key is set', () => {
        const { claude } = loadConfig({
            ...unset,
            ANTHROPIC_API_KEY: 'sk-test',
            COPILOT_ANTHROPIC_MODELS: 'claude-opus-5, claude-haiku-4-5'
        }).plugins.copilot.providers;

        expect(claude?.apiKey).toBe('sk-test');
        expect(claude?.models).toEqual(['claude-opus-5', 'claude-haiku-4-5']);
        // Blank is not "configured": a key that is only whitespace registers a
        // backend whose every call 401s.
        expect(
            loadConfig({ ...unset, ANTHROPIC_API_KEY: '   ' }).plugins.copilot
                .providers.claude
        ).toBeUndefined();
    });

    it('adds the OpenAI-wire backend only once an endpoint is named', () => {
        expect(
            loadConfig({ ...unset }).plugins.copilot.providers.ollama
        ).toBeUndefined();

        const { ollama } = loadConfig({
            ...unset,
            COPILOT_OPENAI_BASE_URL: 'http://localhost:11434/v1'
        }).plugins.copilot.providers;

        // No default endpoint: this used to fall back to a local Ollama, which
        // was harmless while a separate setting chose the provider and is not
        // now — it would put a backend nobody runs at the top of the list.
        expect(ollama?.baseUrl).toBe('http://localhost:11434/v1');
        expect(ollama?.models).toEqual(['llama3.1']);
    });
});
