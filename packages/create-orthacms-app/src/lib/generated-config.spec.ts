import { mkdtempSync, rmSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { renderTemplate, type TemplateValues } from './template';

/**
 * The generated app's `config/` modules, **executed**.
 *
 * Everything else about the template can be checked by reading the rendered
 * text; this cannot. "An empty key means no item in the list" is a runtime
 * decision, and a grep for the `if` that makes it would pass on an `if` whose
 * condition had been inverted.
 *
 * They are cheap to run because of how they are written: each imports its
 * provider package for a *type* — erased — plus the env readers from
 * `@orthacms/utils-server`, so nothing here loads a vendor SDK or a Nest
 * module. The app is rendered inside this package so that `@orthacms/*`
 * resolves from the workspace the way it will resolve from the generated app's
 * own `node_modules`.
 */

const TEMPLATE = join(__dirname, '../../templates/default');

const values = (...ids: string[]): TemplateValues => ({
    appName: 'my-cms',
    appTitle: 'My CMS',
    databaseUrl: 'postgresql://orthacms:orthacms@localhost:5432/my_cms',
    databaseName: 'my_cms',
    adminEmail: 'admin@example.com',
    adminPassword: 'hunter2',
    orthacmsVersion: '9.9.9',
    selection: { enabled: new Set(ids) }
});

let target: string;
let env: NodeJS.ProcessEnv;

beforeEach(() => {
    // Dot-prefixed and inside the package: `node_modules` resolution has to
    // walk up to this workspace, which a system temp directory cannot do.
    target = mkdtempSync(join(__dirname, '../../.rendered-'));
    env = { ...process.env };
});

afterEach(() => {
    process.env = env;
    rmSync(target, { recursive: true, force: true });
    jest.resetModules();
});

/** Renders the app and loads one of its modules. */
function load<T>(ids: string[], path: string): T {
    renderTemplate(TEMPLATE, target, values(...ids));
    return require(join(target, path)) as T;
}

describe('a copilot backend', () => {
    /** Renders with Claude selected and reads its builder back. */
    function anthropicProvider(): () => unknown {
        return load<{ anthropicProvider: () => unknown }>(
            ['media-local', 'rest', 'copilot-anthropic'],
            'apps/server/config/copilot-anthropic'
        ).anthropicProvider;
    }

    /**
     * Setting the key is what *registers* the backend. An unconfigured provider
     * that registered anyway would be the first entry in the list — the one a
     * run naming no provider gets — and would fail on the user's first message,
     * with an authentication error that reads as an Ortha CMS bug.
     */
    it('is absent from the config when its key is unset [create-orthacms-app:I-16]', () => {
        delete process.env['ANTHROPIC_API_KEY'];

        expect(anthropicProvider()()).toBeUndefined();
    });

    it('is absent when the key is set but empty [create-orthacms-app:I-16]', () => {
        process.env['ANTHROPIC_API_KEY'] = '';

        expect(anthropicProvider()()).toBeUndefined();
    });

    it('is present once its key is set [create-orthacms-app:I-16]', () => {
        process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test';

        expect(anthropicProvider()()).toMatchObject({ apiKey: 'sk-ant-test' });
    });
});

describe('an SSO provider', () => {
    /** Renders with OIDC selected and reads its builder back. */
    function oidcProvider(): () => unknown {
        return load<{ oidcProvider: () => unknown }>(
            ['media-local', 'rest', 'sso-oidc'],
            'apps/server/config/sso-oidc'
        ).oidcProvider;
    }

    /**
     * Both halves are needed, and a half-configured provider is the dangerous
     * case: it becomes a sign-in button that can only fail, and every SSO
     * failure looks the same, so whoever clicks it learns nothing.
     */
    it.each([
        ['neither value', {}],
        [
            'an issuer with no client id',
            { SSO_OIDC_ISSUER: 'https://issuer.test' }
        ],
        ['a client id with no issuer', { SSO_OIDC_CLIENT_ID: 'client' }]
    ])(
        'is absent from the config with %s [create-orthacms-app:I-16]',
        (_label, settings) => {
            delete process.env['SSO_OIDC_ISSUER'];
            delete process.env['SSO_OIDC_CLIENT_ID'];
            Object.assign(process.env, settings);

            expect(oidcProvider()()).toBeUndefined();
        }
    );

    it('is present once both are set [create-orthacms-app:I-16]', () => {
        process.env['SSO_OIDC_ISSUER'] = 'https://issuer.test';
        process.env['SSO_OIDC_CLIENT_ID'] = 'client';

        expect(oidcProvider()()).toMatchObject({
            name: 'oidc',
            issuer: 'https://issuer.test',
            clientId: 'client'
        });
    });
});

/**
 * The two providers whose whole wiring was missing.
 *
 * The wizard offered GitHub and SAML from the start, and choosing either added
 * a package to `package.json` and nothing else — no config module, no keys in
 * `.env`, no registration. So the rule these share with OIDC ("present only
 * when its settings are") had never been true of them in either direction, and
 * a test that only covered OIDC could not say so.
 */
describe('the GitHub provider', () => {
    /** Renders with GitHub selected and reads its builder back. */
    function githubProvider(): () => unknown {
        return load<{ githubProvider: () => unknown }>(
            ['media-local', 'rest', 'sso-github'],
            'apps/server/config/sso-github'
        ).githubProvider;
    }

    beforeEach(() => {
        delete process.env['SSO_GITHUB_CLIENT_ID'];
        delete process.env['SSO_GITHUB_CLIENT_SECRET'];
    });

    /**
     * The secret is not optional the way an OIDC one is: GitHub's code
     * exchange has no PKCE, so the secret is the only thing proving the code
     * is being redeemed by this application. Half-configured, the adapter
     * throws at construction — which is a boot failure rather than a sign-in
     * button that fails silently, and either way not what the operator wanted.
     */
    it.each([
        ['neither value', {}],
        ['a client id with no secret', { SSO_GITHUB_CLIENT_ID: 'abc' }],
        ['a secret with no client id', { SSO_GITHUB_CLIENT_SECRET: 'shh' }]
    ])(
        'is absent from the config with %s [create-orthacms-app:I-16]',
        (_label, settings) => {
            Object.assign(process.env, settings);

            expect(githubProvider()()).toBeUndefined();
        }
    );

    it('is present once both are set [create-orthacms-app:I-16]', () => {
        process.env['SSO_GITHUB_CLIENT_ID'] = 'abc';
        process.env['SSO_GITHUB_CLIENT_SECRET'] = 'shh';

        expect(githubProvider()()).toMatchObject({
            name: 'github',
            clientId: 'abc',
            clientSecret: 'shh'
        });
    });

    /**
     * This template once read `SSO_GITHUB_ENTERPRISE_BASE_URL` while the CMS's
     * own host read `SSO_GITHUB_ENTERPRISE_URL`, so a setting copied between
     * the two did nothing. Both read the short name now; the long one still
     * works, with a warning.
     */
    it('reads the name the CMS host reads, and the old one with a warning', () => {
        process.env['SSO_GITHUB_CLIENT_ID'] = 'abc';
        process.env['SSO_GITHUB_CLIENT_SECRET'] = 'shh';
        delete process.env['SSO_GITHUB_ENTERPRISE_URL'];
        process.env['SSO_GITHUB_ENTERPRISE_BASE_URL'] =
            'https://github.acme.com';
        const warn = jest.spyOn(console, 'warn').mockImplementation();

        expect(githubProvider()()).toMatchObject({
            enterpriseBaseUrl: 'https://github.acme.com'
        });
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining(
                'SSO_GITHUB_ENTERPRISE_BASE_URL has been renamed'
            )
        );
        warn.mockRestore();
    });
});

describe('the SAML provider', () => {
    /** Renders with SAML selected and reads its builder back. */
    function samlProvider(): () => unknown {
        return load<{ samlProvider: () => unknown }>(
            ['media-local', 'rest', 'sso-saml'],
            'apps/server/config/sso-saml'
        ).samlProvider;
    }

    const CONFIGURED = {
        SSO_SAML_ENTRY_POINT: 'https://idp.test/sso',
        SSO_SAML_IDP_CERT: 'MIICertificate',
        SSO_SAML_ISSUER: 'urn:my-cms'
    };

    beforeEach(() => {
        for (const key of Object.keys(CONFIGURED)) delete process.env[key];
        delete process.env['PUBLIC_URL'];
    });

    /**
     * The entry point and the certificate have no fallback: SAML has no
     * discovery document and no key endpoint, so the certificate is the whole
     * of the trust relationship.
     */
    it.each(['SSO_SAML_ENTRY_POINT', 'SSO_SAML_IDP_CERT'])(
        'is absent from the config without %s [create-orthacms-app:I-16]',
        (missing) => {
            Object.assign(process.env, CONFIGURED);
            delete process.env[missing];

            expect(samlProvider()()).toBeUndefined();
        }
    );

    it('defaults the entity id to PUBLIC_URL', () => {
        Object.assign(process.env, CONFIGURED, {
            PUBLIC_URL: 'https://cms.example.test'
        });
        delete process.env['SSO_SAML_ISSUER'];

        expect(samlProvider()()).toMatchObject({
            issuer: 'https://cms.example.test'
        });
    });

    it('is present once all three are set [create-orthacms-app:I-16]', () => {
        Object.assign(process.env, CONFIGURED);

        expect(samlProvider()()).toMatchObject({
            name: 'saml',
            entryPoint: 'https://idp.test/sso',
            issuer: 'urn:my-cms'
        });
    });

    /**
     * An environment variable cannot hold a real newline, so a PEM pasted into
     * `.env` arrives as one line of `\n` escapes. Left as they are, the XML
     * signature check fails on a certificate that looks correct in the file.
     */
    it('puts the certificate’s newlines back', () => {
        Object.assign(process.env, CONFIGURED);
        process.env['SSO_SAML_IDP_CERT'] =
            '-----BEGIN CERTIFICATE-----\\nMIIC\\n-----END CERTIFICATE-----';

        expect(samlProvider()()).toMatchObject({
            idpCert:
                '-----BEGIN CERTIFICATE-----\nMIIC\n-----END CERTIFICATE-----'
        });
    });

    /**
     * SAML carries no verification claim at all, so this can only ever be an
     * operator's assertion — and it is the only gate on a first sign-in
     * claiming an existing account. It must not default to true, and a blank
     * line in `.env` must not read as one.
     */
    it.each([
        ['unset', undefined],
        ['blank', ''],
        ['false', 'false']
    ])(
        'treats an email-verified flag that is %s as not verified',
        (_label, value) => {
            Object.assign(process.env, CONFIGURED);
            if (value === undefined) {
                delete process.env['SSO_SAML_EMAIL_VERIFIED'];
            } else {
                process.env['SSO_SAML_EMAIL_VERIFIED'] = value;
            }

            expect(samlProvider()()).toMatchObject({ emailVerified: false });
        }
    );
});

/**
 * Mail, whose "unset" answer is a whole configuration rather than a missing
 * value.
 *
 * Every other builder here answers "is this backend configured?" with a
 * provider or `undefined` inside a config that exists either way. This one
 * returns `undefined` for the config itself, and that is what a freshly
 * scaffolded app runs: no plugin, no queue, no worker, and the invite route
 * still handing the link back. Inverting the check would make a keyless app
 * refuse to boot — `APP_URL` and `MAIL_FROM` are required the moment a backend
 * is named — which is a scaffolder that generates an app that cannot start.
 */
describe('mail', () => {
    /** Renders with SMTP selected and reads its builder back. */
    function mailConfig(): () => unknown {
        return load<{ mailConfig: () => unknown }>(
            ['media-local', 'rest', 'mail-smtp'],
            'apps/server/config/mail'
        ).mailConfig;
    }

    const CONFIGURED = {
        MAIL_URL: 'smtp://smtp.example.test:587',
        PUBLIC_URL: 'https://cms.example.test',
        MAIL_FROM: 'My CMS <no-reply@example.test>'
    };

    beforeEach(() => {
        for (const key of [...Object.keys(CONFIGURED), 'MAIL_PROVIDER']) {
            delete process.env[key];
        }
    });

    it.each([
        ['unset', undefined],
        ['blank', '']
    ])(
        'sends nothing when MAIL_URL is %s [create-orthacms-app:I-35]',
        (_label, value) => {
            if (value !== undefined) process.env['MAIL_URL'] = value;

            expect(mailConfig()()).toBeUndefined();
        }
    );

    /**
     * A backend the app does not have must not read as "send nothing".
     * Silently sending nothing is the failure the whole arrangement is built
     * to avoid, and it would show up as invitations nobody receives rather
     * than as a boot error.
     */
    it('refuses a backend it was not scaffolded with', () => {
        process.env['MAIL_URL'] = 'console://';

        expect(() => mailConfig()()).toThrow(/does not have installed/);
    });

    /**
     * A sender is required the moment a relay is named, and in production so
     * is `PUBLIC_URL`, which every link is built from — said at boot rather
     * than on somebody's first invitation.
     */
    it('refuses to boot with a relay named and no MAIL_FROM', () => {
        Object.assign(process.env, CONFIGURED);
        delete process.env['MAIL_FROM'];

        expect(() => mailConfig()()).toThrow(/MAIL_FROM/);
    });

    it('refuses to boot in production with a relay named and no PUBLIC_URL', () => {
        Object.assign(process.env, CONFIGURED, { NODE_ENV: 'production' });
        delete process.env['PUBLIC_URL'];

        expect(() => mailConfig()()).toThrow(/PUBLIC_URL/);
    });

    it('builds the relay settings once a relay is named [create-orthacms-app:I-35]', () => {
        Object.assign(process.env, CONFIGURED);

        expect(mailConfig()()).toMatchObject({
            backend: 'smtp',
            appUrl: 'https://cms.example.test',
            from: 'My CMS <no-reply@example.test>',
            smtp: { host: 'smtp.example.test', port: 587 }
        });
    });

    /**
     * Passing `secure: false` turns implicit TLS off explicitly, where leaving
     * the key out lets the adapter upgrade with STARTTLS — which is what port
     * 587 wants. `smtp://` must therefore leave it out.
     */
    it('leaves implicit TLS unset for smtp:// rather than switching it off', () => {
        Object.assign(process.env, CONFIGURED);

        expect(mailConfig()()).toMatchObject({
            smtp: expect.not.objectContaining({ secure: expect.anything() })
        });
    });
});

/**
 * A key the generated `.env` ships blank.
 *
 * `env.tmpl` writes twenty-odd keys with nothing on the right-hand side —
 * that is how an operator finds out a setting exists — so "present but empty"
 * is the *default* state of a fresh app, not a mistake somebody has to make.
 * `??` falls back on `undefined`, never on `''`, so a raw
 * `process.env['X'] ?? default` in `config/` lets an untouched line beat the
 * default it was there to fall back to. These load the rendered modules and
 * pass the blank in.
 */
describe('a setting written into .env with no value', () => {
    it('keeps the default upload root rather than writing blobs to ""', () => {
        process.env['MEDIA_LOCAL_ROOT'] = '';

        expect(
            load<{ mediaStorage: () => { rootDir: string } }>(
                ['media-local', 'rest'],
                'apps/server/config/media-storage'
            ).mediaStorage()
        ).toEqual({ rootDir: './.storage/media' });
    });

    it('keeps the default S3 region rather than signing for region ""', () => {
        // R2 rejects a request signed for the empty region, and the AWS SDK
        // builds an endpoint from it — neither failure names the variable.
        process.env['MEDIA_S3_BUCKET'] = 'uploads';
        process.env['MEDIA_S3_REGION'] = '';

        expect(
            load<{ mediaStorage: () => { region: string } }>(
                ['media-s3', 'rest'],
                'apps/server/config/media-storage'
            ).mediaStorage()
        ).toMatchObject({ region: 'auto' });
    });

    it('refuses a root administrator password made of spaces', () => {
        // Untrimmed, `'   '` passed identity's own `if (!password)` guard and
        // became the administrator's actual password.
        process.env['ORTHACMS_ROOT_ADMIN_EMAIL'] = 'admin@example.test';
        process.env['ORTHACMS_ROOT_ADMIN_PASSWORD'] = '   ';

        expect(
            load<{
                identityConfig: () => { rootAdmin: { password: string } };
            }>(
                ['media-local', 'rest'],
                'apps/server/config/identity'
            ).identityConfig().rootAdmin.password
        ).toBe('');
    });
});

/**
 * The webhook URL policy.
 *
 * These two flags decide where this server can be talked into connecting, and
 * both default to **off** because a webhook is the server making a request to
 * an address a user typed — the shape of every SSRF. The reason they are pinned
 * here rather than trusted to the plugin is that they were **documented in
 * `.env` and read by nothing** for several releases: `config/webhooks.ts` did
 * not exist and `WebhooksPlugin()` took no argument, so an operator who set
 * `WEBHOOKS_ALLOW_PRIVATE_NETWORKS=true` to reach an in-cluster receiver got the
 * default anyway, silently.
 *
 * So the assertion is deliberately end-to-end for a config module: the value in
 * the environment has to come out of the builder. A default that is merely
 * correct proves nothing here — the broken version had correct defaults too.
 */
/**
 * Settings that are code in a generated app, not environment: a retired
 * variable set to anything but its old default refuses to start, because
 * ignoring it would change the app without a word.
 */
describe('a variable that is no longer read', () => {
    /** Renders a default app and reads its root config back. */
    function rootConfig(): { database: { outboxRetentionDays: number } } {
        return load<{
            default: { database: { outboxRetentionDays: number } };
        }>(['media-local', 'rest'], 'apps/server/orthacms.config').default;
    }

    beforeEach(() => {
        process.env['DATABASE_URL'] =
            'postgresql://orthacms:orthacms@localhost:5432/my_cms';
        delete process.env['OUTBOX_RETENTION_DAYS'];
    });

    it('leaves the value in the config', () => {
        expect(rootConfig().database.outboxRetentionDays).toBe(30);
    });

    it('is a warning at its old default and a refusal otherwise', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation();
        process.env['OUTBOX_RETENTION_DAYS'] = '30';
        expect(rootConfig().database.outboxRetentionDays).toBe(30);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();

        jest.resetModules();
        process.env['OUTBOX_RETENTION_DAYS'] = '7';
        expect(() => rootConfig()).toThrow(/OUTBOX_RETENTION_DAYS=7/);
    });
});

describe('the webhook URL policy', () => {
    /** Renders a default app and reads the webhooks builder back. */
    function webhooksConfig(): () => {
        allowInsecureUrls?: boolean;
        allowPrivateNetworks?: boolean;
        retentionDays?: number;
        deliveryIntervalMs?: number;
    } {
        return load<{ webhooksConfig: () => never }>(
            ['media-local', 'rest'],
            'apps/server/config/webhooks'
        ).webhooksConfig;
    }

    it('refuses plain HTTP and private networks by default', () => {
        delete process.env['WEBHOOKS_ALLOW_INSECURE_URLS'];
        delete process.env['WEBHOOKS_ALLOW_PRIVATE_NETWORKS'];

        expect(webhooksConfig()()).toMatchObject({
            allowInsecureUrls: false,
            allowPrivateNetworks: false
        });
    });

    it('lets the environment widen it, which is the whole point [create-orthacms-app:I-34]', () => {
        process.env['WEBHOOKS_ALLOW_INSECURE_URLS'] = 'true';
        process.env['WEBHOOKS_ALLOW_PRIVATE_NETWORKS'] = 'true';

        expect(webhooksConfig()()).toMatchObject({
            allowInsecureUrls: true,
            allowPrivateNetworks: true
        });
    });

    it('queues without sending when ORTHACMS_WORKERS=false', () => {
        process.env['ORTHACMS_WORKERS'] = 'false';

        expect(webhooksConfig()()).toMatchObject({ deliveryIntervalMs: 0 });
        delete process.env['ORTHACMS_WORKERS'];
    });
});

/**
 * The Content model page's settings.
 *
 * Editing writes TypeScript and a migration into the app's own source tree, so
 * it is the one switch here whose wrong default is a deployment that edits its
 * own schema over HTTP. It has to be **off** unless asked for, and production
 * has to be reported as production whatever the flag says — the plugin refuses
 * editing on that, not on the flag alone (ADR-0020).
 */
describe('the schema builder', () => {
    type BuilderConfig = {
        enabled: boolean;
        production: boolean;
        projectRoot: string;
        restart?: string;
    };

    /** Renders a default app and reads the schema builder's builder back. */
    function schemaBuilderConfig(): () => BuilderConfig {
        return load<{ schemaBuilderConfig: () => BuilderConfig }>(
            ['media-local', 'rest'],
            'apps/server/config/schema-builder'
        ).schemaBuilderConfig;
    }

    beforeEach(() => {
        delete process.env['SCHEMA_BUILDER'];
        delete process.env['SCHEMA_BUILDER_ROOT'];
        delete process.env['SCHEMA_BUILDER_RESTART'];
        process.env['NODE_ENV'] = 'test';
    });

    it('leaves editing off until it is asked for', () => {
        expect(schemaBuilderConfig()()).toMatchObject({
            enabled: false,
            production: false,
            restart: 'watch'
        });
    });

    it('treats the blank line .env ships as off', () => {
        process.env['SCHEMA_BUILDER'] = '';

        expect(schemaBuilderConfig()().enabled).toBe(false);
    });

    it('turns editing on with SCHEMA_BUILDER=true', () => {
        process.env['SCHEMA_BUILDER'] = 'true';

        expect(schemaBuilderConfig()().enabled).toBe(true);
    });

    it('reports production as production, whatever the flag says', () => {
        process.env['SCHEMA_BUILDER'] = 'true';
        process.env['NODE_ENV'] = 'production';

        expect(schemaBuilderConfig()()).toMatchObject({
            enabled: true,
            production: true
        });
    });

    /**
     * `SchemaBuilderPlugin` refuses a relative root at construction, and the
     * working directory `orthacms dev` starts the server from is the app root —
     * so the default is `apps/server` under it, absolute.
     */
    it('resolves the server app folder from the working directory', () => {
        const { projectRoot } = schemaBuilderConfig()();

        expect(isAbsolute(projectRoot)).toBe(true);
        expect(projectRoot).toBe(resolve(process.cwd(), 'apps/server'));
    });

    it('takes SCHEMA_BUILDER_ROOT and a manual restart from the environment', () => {
        process.env['SCHEMA_BUILDER_ROOT'] = 'server';
        process.env['SCHEMA_BUILDER_RESTART'] = 'manual';

        expect(schemaBuilderConfig()()).toMatchObject({
            projectRoot: resolve(process.cwd(), 'server'),
            restart: 'manual'
        });
    });

    it('refuses a restart mode it does not know instead of reading it as watch', () => {
        process.env['SCHEMA_BUILDER_RESTART'] = 'manaul';

        expect(() => schemaBuilderConfig()()).toThrow(
            'SCHEMA_BUILDER_RESTART must be one of watch, manual'
        );
    });
});

/**
 * The origin guard on sign-in. A browser sends `Origin` on every POST,
 * same-origin included, so the origin `npm start` serves the admin from must be
 * allowed by default — it was not, and a freshly generated app answered every
 * browser sign-in with a 403 while the smoke test, which sent no `Origin`,
 * passed.
 */
describe('the allowed origins', () => {
    /** Renders a default app and reads the identity builder back. */
    function allowedOrigins(): string[] {
        return load<{ identityConfig: () => { allowedOrigins: string[] } }>(
            ['media-local', 'rest'],
            'apps/server/config/identity'
        ).identityConfig().allowedOrigins;
    }

    beforeEach(() => {
        for (const key of [
            'ALLOWED_ORIGINS',
            'PUBLIC_URL',
            'ADMIN_PORT',
            'PORT'
        ]) {
            delete process.env[key];
        }
    });

    it('allows the dev server and the origin `npm start` serves', () => {
        expect(allowedOrigins()).toEqual([
            'http://localhost:4200',
            'http://localhost:3000'
        ]);
    });

    it('follows PORT, which is what `npm start` listens on', () => {
        process.env['PORT'] = '8080';

        expect(allowedOrigins()).toContain('http://localhost:8080');
    });

    it('takes the deployment origin from PUBLIC_URL, and only that in production', () => {
        process.env['PUBLIC_URL'] = 'https://cms.example.com/';
        process.env['NODE_ENV'] = 'production';

        expect(allowedOrigins()).toEqual(['https://cms.example.com']);
        process.env['NODE_ENV'] = 'test';
    });
});
