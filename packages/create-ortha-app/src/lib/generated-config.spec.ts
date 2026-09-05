import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
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
    databaseUrl: 'postgresql://ortha:ortha@localhost:5432/my_cms',
    databaseName: 'my_cms',
    adminEmail: 'admin@example.com',
    adminPassword: 'hunter2',
    orthaVersion: '9.9.9',
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
     * with an authentication error that reads as an Ortha bug.
     */
    it('is absent from the config when its key is unset [create-ortha-app:I-16]', () => {
        delete process.env['ANTHROPIC_API_KEY'];

        expect(anthropicProvider()()).toBeUndefined();
    });

    it('is absent when the key is set but empty [create-ortha-app:I-16]', () => {
        process.env['ANTHROPIC_API_KEY'] = '';

        expect(anthropicProvider()()).toBeUndefined();
    });

    it('is present once its key is set [create-ortha-app:I-16]', () => {
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
        'is absent from the config with %s [create-ortha-app:I-16]',
        (_label, settings) => {
            delete process.env['SSO_OIDC_ISSUER'];
            delete process.env['SSO_OIDC_CLIENT_ID'];
            Object.assign(process.env, settings);

            expect(oidcProvider()()).toBeUndefined();
        }
    );

    it('is present once both are set [create-ortha-app:I-16]', () => {
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
    it('leaves the OIDC provider name at its default rather than naming it ""', () => {
        // Registered under `''`, the provider's callback is
        // `/api/auth/sso//callback`, and nothing reports it at boot.
        process.env['SSO_OIDC_ISSUER'] = 'https://issuer.test';
        process.env['SSO_OIDC_CLIENT_ID'] = 'client';
        process.env['SSO_OIDC_NAME'] = '';

        expect(
            load<{ oidcProvider: () => { name: string } | undefined }>(
                ['media-local', 'rest', 'sso-oidc'],
                'apps/server/config/sso-oidc'
            ).oidcProvider()
        ).toMatchObject({ name: 'oidc' });
    });

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
        process.env['ORTHA_ROOT_ADMIN_EMAIL'] = 'admin@example.test';
        process.env['ORTHA_ROOT_ADMIN_PASSWORD'] = '   ';

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
