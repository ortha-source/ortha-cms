import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { OrthaCmsConfig } from '../orthacms.config';

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

/** Reloads `orthacms.config` with `env` applied over the ambient environment. */
function loadConfig(env: Record<string, string | undefined>): OrthaCmsConfig {
    const saved = { ...process.env };
    for (const [key, value] of Object.entries(env)) {
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
    try {
        let loaded: OrthaCmsConfig | undefined;
        jest.isolateModules(() => {
            loaded = require('../orthacms.config').default as OrthaCmsConfig;
        });
        return loaded as OrthaCmsConfig;
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

/** What production needs on top of `DATABASE_URL`. */
const PRODUCTION = {
    NODE_ENV: 'production',
    PUBLIC_URL: 'https://cms.example.com'
} as const;

describe('numeric settings', () => {
    it('falls back to the default when unset or empty', () => {
        // `.env.example` ships keys with no value on the right-hand side, so
        // empty has to mean "not configured", not "configured badly".
        expect(loadConfig({ PORT: undefined }).port).toBe(3000);
        expect(loadConfig({ PORT: '' }).port).toBe(3000);
    });

    it('reads a plain positive integer', () => {
        expect(loadConfig({ PORT: '8080' }).port).toBe(8080);
    });

    it('rejects a negative, a zero and exponent notation', () => {
        // `Number(x) || default` accepted a negative, swallowed a zero and
        // parsed `1e9` — all three silently.
        for (const value of ['-1', '0', '1e3']) {
            expect(loadError({ COPILOT_USER_DAILY_TOKENS: value })).toContain(
                'COPILOT_USER_DAILY_TOKENS'
            );
        }
    });

    it('rejects a non-numeric value', () => {
        expect(loadError({ PORT: 'eight-thousand' })).toContain('PORT');
    });
});

describe('settings that are code, not environment', () => {
    it('keeps the lifetimes, limits and budgets in the config itself', () => {
        const config = loadConfig({});
        expect(config.plugins.identity.session.ttlSeconds).toBe(
            60 * 60 * 24 * 7
        );
        expect(config.plugins.identity.rateLimit).toEqual({
            ttlSeconds: 60,
            limit: 10
        });
        expect(config.database.outboxRetentionDays).toBe(30);
        expect(config.plugins.contentGraphql.limits?.maxDepth).toBe(8);
    });

    it('ignores a retired variable set to its old default, with a warning', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation();
        expect(
            loadConfig({ SESSION_TTL_SECONDS: '604800' }).plugins.identity
                .session.ttlSeconds
        ).toBe(60 * 60 * 24 * 7);
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('SESSION_TTL_SECONDS is no longer read')
        );
        warn.mockRestore();
    });

    it('refuses a retired variable set to anything else, saying where it went', () => {
        // Ignoring it would quietly loosen a security setting:
        // `GRAPHQL_MAX_DEPTH=4` becoming 8, `LOGIN_RATE_LIMIT=3` becoming 10.
        const message = loadError({
            LOGIN_RATE_LIMIT: '3',
            GRAPHQL_MAX_DEPTH: '4'
        });
        expect(message).toContain('LOGIN_RATE_LIMIT=3');
        expect(message).toContain('config/identity.ts');
        expect(message).toContain('GRAPHQL_MAX_DEPTH=4');
        expect(message).toContain('config/graphql.ts');
    });

    it('points a renamed provider at code, where renaming is a reviewed change', () => {
        // The name is what every `sso_identities` row refers to.
        expect(loadError({ SSO_OIDC_NAME: 'staff' })).toContain(
            'the `oidc` provider in config/identity.ts'
        );
    });
});

describe('NODE_ENV', () => {
    it('publishes the API reference and omits Secure when unset (local development)', () => {
        const config = loadConfig({ NODE_ENV: undefined, API_DOCS: undefined });
        expect(config.docs.enabled).toBe(true);
        expect(config.plugins.identity.session.cookieSecure).toBe(false);
    });

    it('withholds the reference and sets Secure in production', () => {
        const config = loadConfig({ ...PRODUCTION, API_DOCS: undefined });
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
            loadConfig({ ...PRODUCTION, API_DOCS: 'true' }).docs.enabled
        ).toBe(true);
        expect(
            loadConfig({ NODE_ENV: undefined, API_DOCS: 'false' }).docs.enabled
        ).toBe(false);
        // Any other spelling refuses to load rather than guessing a direction.
        expect(loadError({ NODE_ENV: undefined, API_DOCS: 'yes' })).toContain(
            'API_DOCS must be true or false'
        );
    });
});

describe('schema builder', () => {
    const off = {
        SCHEMA_BUILDER: undefined,
        SCHEMA_BUILDER_ROOT: undefined,
        SCHEMA_BUILDER_RESTART: undefined
    };

    it('is read-only, watch-restarted and rooted at apps/server by default', () => {
        const config = loadConfig({ ...off, NODE_ENV: undefined }).plugins
            .schemaBuilder;
        expect(config.enabled).toBe(false);
        expect(config.production).toBe(false);
        expect(config.restart).toBe('watch');
        // Every dev entry point starts the server from the repository root.
        expect(config.projectRoot).toBe(join(process.cwd(), 'apps/server'));
    });

    it('carries production through, so the plugin can refuse the flag there', () => {
        // ADR-0020: the flag alone never turns editing on in production; the
        // plugin decides that, and needs to be told which one it is in.
        const config = loadConfig({
            ...off,
            ...PRODUCTION,
            SCHEMA_BUILDER: 'true'
        }).plugins.schemaBuilder;
        expect(config.enabled).toBe(true);
        expect(config.production).toBe(true);
    });

    it('resolves SCHEMA_BUILDER_ROOT against the working directory', () => {
        expect(
            loadConfig({ ...off, SCHEMA_BUILDER_ROOT: 'elsewhere/app' }).plugins
                .schemaBuilder.projectRoot
        ).toBe(join(process.cwd(), 'elsewhere/app'));
        expect(
            loadConfig({ ...off, SCHEMA_BUILDER_ROOT: '/srv/cms' }).plugins
                .schemaBuilder.projectRoot
        ).toBe('/srv/cms');
    });

    it('reads manual restarts, and anything else as watch', () => {
        expect(
            loadConfig({ ...off, SCHEMA_BUILDER_RESTART: 'manual' }).plugins
                .schemaBuilder.restart
        ).toBe('manual');
        expect(
            loadConfig({ ...off, SCHEMA_BUILDER_RESTART: '' }).plugins
                .schemaBuilder.restart
        ).toBe('watch');
    });
});

describe('copilot run ceilings', () => {
    it('leaves `limits` to the plugin defaults, which are code', () => {
        // Spreading `limits: {}` would pin nothing, but naming them here would
        // shadow DEFAULT_RUN_LIMITS; raising one is an edit to config/copilot.ts.
        expect(loadConfig({}).plugins.copilot.limits).toBeUndefined();
    });

    it('refuses the retired ceilings when they hold anything but the old default', () => {
        expect(loadError({ COPILOT_MAX_STEPS: '50' })).toContain(
            'config/copilot.ts'
        );
    });
});

describe('copilot usage limits', () => {
    const unset = {
        COPILOT_USER_DAILY_TOKENS: undefined,
        COPILOT_WORKSPACE_DAILY_TOKENS: undefined,
        COPILOT_RUNS_PER_MINUTE: undefined,
        COPILOT_MAX_CONCURRENT_RUNS: undefined
    };

    // No quota is the default, and an empty `.env` line is how it is written.
    it('omits `quotas` entirely when none are set', () => {
        expect(loadConfig(unset).plugins.copilot.quotas).toBeUndefined();
        expect(
            loadConfig({
                ...unset,
                COPILOT_USER_DAILY_TOKENS: '',
                COPILOT_WORKSPACE_DAILY_TOKENS: '',
                COPILOT_RUNS_PER_MINUTE: '',
                COPILOT_MAX_CONCURRENT_RUNS: ''
            }).plugins.copilot.quotas
        ).toBeUndefined();
    });

    it('passes each configured limit through, and only those', () => {
        expect(
            loadConfig({
                ...unset,
                COPILOT_USER_DAILY_TOKENS: '2000000',
                COPILOT_MAX_CONCURRENT_RUNS: '2'
            }).plugins.copilot.quotas
        ).toEqual({ userDailyTokens: 2_000_000, maxConcurrentRuns: 2 });
        expect(
            loadConfig({
                ...unset,
                COPILOT_WORKSPACE_DAILY_TOKENS: '20000000',
                COPILOT_RUNS_PER_MINUTE: '10'
            }).plugins.copilot.quotas
        ).toEqual({ workspaceDailyTokens: 20_000_000, runsPerMinute: 10 });
    });

    // Zero is not "off" — it would refuse every run — so it is refused here,
    // at boot, by name.
    it.each([
        'COPILOT_USER_DAILY_TOKENS',
        'COPILOT_WORKSPACE_DAILY_TOKENS',
        'COPILOT_RUNS_PER_MINUTE',
        'COPILOT_MAX_CONCURRENT_RUNS'
    ])('rejects zero for %s', (name) => {
        expect(loadError({ ...unset, [name]: '0' })).toContain(name);
    });
});

describe('ORTHACMS_WORKERS', () => {
    it('sends webhooks and mail from this process by default', () => {
        const config = loadConfig({
            ORTHACMS_WORKERS: undefined,
            MAIL_URL: 'console://',
            MAIL_FROM: 'CMS <cms@example.com>'
        });
        expect(config.plugins.webhooks.deliveryIntervalMs).toBeUndefined();
        expect(config.plugins.mail?.deliveryIntervalMs).toBeUndefined();
    });

    it('queues without sending when false — a web node in front of a worker', () => {
        // The plugins read an interval of 0 as "this process sends nothing";
        // the two variables that used to say so separately could not both say
        // it (the mail one refused 0).
        const config = loadConfig({
            ORTHACMS_WORKERS: 'false',
            MAIL_URL: 'console://',
            MAIL_FROM: 'CMS <cms@example.com>'
        });
        expect(config.plugins.webhooks.deliveryIntervalMs).toBe(0);
        expect(config.plugins.mail?.deliveryIntervalMs).toBe(0);
    });
});

describe('a value outside what a setting accepts', () => {
    it('refuses an unknown direct-serve mode instead of reading it as off', () => {
        expect(loadError({ MEDIA_DIRECT_SERVE: 'signed_url' })).toContain(
            'MEDIA_DIRECT_SERVE must be one of off, signed-url'
        );
    });

    it('refuses a flag that is neither true nor false', () => {
        expect(loadError({ COPILOT_ENABLED: 'yes' })).toContain(
            'COPILOT_ENABLED must be true or false'
        );
    });

    it('reads SSO_ALLOW_PASSWORD_LOGIN like every other flag', () => {
        // It used to be "anything but the exact string false is on", the
        // opposite convention to every other switch in this file.
        const allowed = (value: string | undefined) =>
            loadConfig({ SSO_ALLOW_PASSWORD_LOGIN: value }).plugins.identity.sso
                ?.allowPasswordLogin;
        expect(allowed(undefined)).toBe(true);
        expect(allowed('false')).toBe(false);
        expect(allowed('0')).toBe(false);
        expect(loadError({ SSO_ALLOW_PASSWORD_LOGIN: 'no' })).toContain(
            'SSO_ALLOW_PASSWORD_LOGIN must be true or false'
        );
    });
});

describe('PUBLIC_URL and the allowed origins', () => {
    const unset = {
        ALLOWED_ORIGINS: undefined,
        PUBLIC_URL: undefined,
        APP_URL: undefined,
        EXTRA_ORIGINS: undefined,
        ADMIN_PORT: undefined,
        PORT: undefined
    };

    it('allows the dev server and the server port outside production', () => {
        // A browser sends `Origin` on every POST, so the port `npm start`
        // serves the admin from has to be on the list too.
        expect(loadConfig(unset).plugins.identity.allowedOrigins).toEqual([
            'http://localhost:4200',
            'http://localhost:3000'
        ]);
    });

    it('follows ADMIN_PORT, so a parallel worktree stack is not rejected', () => {
        expect(
            loadConfig({ ...unset, ADMIN_PORT: '4207' }).plugins.identity
                .allowedOrigins[0]
        ).toBe('http://localhost:4207');
    });

    it('puts PUBLIC_URL first, then EXTRA_ORIGINS — and nothing else in production', () => {
        // SSO builds its callbacks from the first entry.
        expect(
            loadConfig({
                ...unset,
                ...PRODUCTION,
                EXTRA_ORIGINS:
                    'https://admin.example.com/, https://cms.example.com'
            }).plugins.identity.allowedOrigins
        ).toEqual(['https://cms.example.com', 'https://admin.example.com']);
    });

    it('refuses to start in production without PUBLIC_URL', () => {
        expect(loadError({ ...unset, NODE_ENV: 'production' })).toContain(
            'Missing required environment variable PUBLIC_URL'
        );
    });

    it('refuses a URL without a scheme', () => {
        expect(
            loadError({ ...unset, PUBLIC_URL: 'cms.example.com' })
        ).toContain('PUBLIC_URL must be an absolute URL');
    });

    it('still reads APP_URL as PUBLIC_URL, with a warning', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation();
        expect(
            loadConfig({
                ...unset,
                NODE_ENV: 'production',
                APP_URL: 'https://old.example.com'
            }).plugins.identity.allowedOrigins
        ).toEqual(['https://old.example.com']);
        warn.mockRestore();
    });

    it('still honours ALLOWED_ORIGINS verbatim, trimmed, with a warning', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation();
        expect(
            loadConfig({
                ...unset,
                ALLOWED_ORIGINS: ' http://a.test , ,http://b.test '
            }).plugins.identity.allowedOrigins
        ).toEqual(['http://a.test', 'http://b.test']);
        warn.mockRestore();
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

/**
 * A key that is present but blank.
 *
 * `.env.example` ships forty-two keys with nothing on the right-hand side and
 * the documented flow is to copy it to `.env`, so the state under test here is
 * not an edge case — it is what following the instructions produces. `??` falls
 * back on `undefined`, not on `''`, so every `process.env['X'] ?? default` in
 * this folder handed the blank line the win over the default it was meant to
 * fall back to. The readers in `@orthacms/utils-server` decide "empty means not
 * configured" once; these assert each site actually goes through them.
 *
 * Each case sets the *other* variables it needs, because `loadConfig` layers
 * over the ambient environment and this machine's `.env` is exactly the file
 * that carries the blanks.
 */
describe('a variable that is set but empty', () => {
    const oidc = {
        SSO_OIDC_ISSUER: 'https://issuer.test',
        SSO_OIDC_CLIENT_ID: 'client'
    };

    it('leaves the provider name at its default rather than naming it ""', () => {
        // The reported defect. A provider named `''` is registered under the
        // empty string, so its callback is `/api/auth/sso//callback` — and
        // nothing says so at boot, or ever.
        const { oidc: provider } = loadConfig({
            ...oidc,
            SSO_OIDC_NAME: ''
        }).plugins.identity.ssoProviders;

        expect(provider?.name).toBe('oidc');
    });

    it('lets API_PUBLIC_URL through a blank SSO_SAML_ISSUER', () => {
        // The worst of the set, because the blank was not merely losing its own
        // default — it was shadowing a value the operator *had* set, one `??`
        // to its right, and leaving the SAML entity id empty.
        const { saml } = loadConfig({
            SSO_SAML_ENTRY_POINT: 'https://idp.test/sso',
            SSO_SAML_IDP_CERT: 'CERT',
            SSO_SAML_ISSUER: '',
            API_PUBLIC_URL: 'https://cms.example.test'
        }).plugins.identity.ssoProviders;

        expect(saml?.issuer).toBe('https://cms.example.test');
    });

    it('provisions into the default role rather than a role named ""', () => {
        // A role named `''` matches no row in `roles`, so just-in-time
        // provisioning fails on the first sign-in it was configured for.
        expect(
            loadConfig({
                SSO_PROVISION_DOMAINS: 'example.test',
                SSO_PROVISION_ROLE: ''
            }).plugins.identity.sso?.provisioning?.defaultRole
        ).toBe('viewer');
    });

    it('keeps the default upload root rather than writing blobs to ""', () => {
        expect(
            loadConfig({ MEDIA_LOCAL_ROOT: '' }).plugins.media.storage.rootDir
        ).toBe('./.storage/media');
    });

    it('turns password login off for a value with a stray space', () => {
        // `'false ' !== 'false'` was true, so the switch failed *open*: an
        // operator who meant to require SSO kept password login enabled.
        expect(
            loadConfig({ SSO_ALLOW_PASSWORD_LOGIN: 'false ' }).plugins.identity
                .sso?.allowPasswordLogin
        ).toBe(false);
    });

    it('refuses a root administrator password made of spaces', () => {
        // Untrimmed, `'   '` passed identity's own `if (!password)` guard and
        // became the administrator's actual password.
        expect(
            loadConfig({
                ORTHACMS_ROOT_ADMIN_EMAIL: 'admin@example.test',
                ORTHACMS_ROOT_ADMIN_PASSWORD: '   '
            }).plugins.identity.rootAdmin?.password
        ).toBe('');
    });
});

/**
 * The rule that keeps the block above from being needed again.
 *
 * Every one of those defects was the same edit: someone needed a string with a
 * default, reached for `process.env['X'] ?? 'y'`, and skipped the one place
 * "empty means not configured" is decided. Nothing stopped them — the rule was
 * prose in `AGENTS.md` and a sentence in `orthacms.config.ts`'s header. The
 * behavioural tests pin the six sites that were wrong; this pins the seventh
 * nobody has written yet.
 *
 * Deliberately a grep over source text rather than a check of values. There is
 * no runtime signal to assert on: a raw read and a `readEnv` read return the
 * same thing for every input except the blank one, which is exactly the input a
 * new site's author will not think to try.
 */
describe('config/ reads the environment only through the shared readers', () => {
    const CONFIG = join(__dirname, '../config');

    it.each(readdirSync(CONFIG).filter((name) => name.endsWith('.ts')))(
        'config/%s names no process.env of its own',
        (name) => {
            const source = readFileSync(join(CONFIG, name), 'utf8');
            // Comments may name it — the header of `env.ts` explains why the
            // derivation there is a constant — so this looks for a subscript,
            // which is the only shape a read takes in this folder.
            expect(source).not.toMatch(/process\.env\s*\[/);
        }
    );

    it('finds the modules it is meant to be checking', () => {
        // Without this the suite above passes on an empty folder, a renamed
        // directory, or a `.ts` filter that stopped matching.
        expect(
            readdirSync(CONFIG).filter((name) => name.endsWith('.ts')).length
        ).toBeGreaterThan(5);
    });
});
