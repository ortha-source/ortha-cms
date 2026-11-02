import { RENAMED } from '@orthacms/utils-server';

import { ENV_CATALOG } from './catalog';
import * as builders from '../index';
import { RETIRED_ENV } from './retired';

/**
 * The catalog is only worth having if it is complete in both directions: a
 * variable a builder reads and the catalog does not list is undocumented, and
 * one the catalog lists and nothing reads is a setting that changes nothing.
 */
describe('the environment catalog', () => {
    const saved = process.env;
    afterEach(() => {
        process.env = saved;
    });

    /** Every variable name the builders touch, under an environment that turns every branch on. */
    function namesRead(): Set<string> {
        const read = new Set<string>();
        const base: Record<string, string> = {
            DATABASE_URL: 'postgresql://x',
            PUBLIC_URL: 'https://cms.example.com',
            MAIL_URL: 'smtp://u:p@relay.example.com:587',
            MAIL_FROM: 'CMS <cms@example.com>',
            SSO_OIDC_ISSUER: 'https://idp.example.com',
            SSO_OIDC_CLIENT_ID: 'id',
            SSO_GITHUB_CLIENT_ID: 'id',
            SSO_GITHUB_CLIENT_SECRET: 'secret',
            SSO_SAML_ENTRY_POINT: 'https://idp.example.com/sso',
            SSO_SAML_IDP_CERT: 'CERT',
            SSO_PROVISION_DOMAINS: 'example.com',
            ANTHROPIC_API_KEY: 'key',
            COPILOT_OPENAI_BASE_URL: 'http://localhost:11434/v1',
            MEDIA_S3_BUCKET: 'b',
            MEDIA_GCS_BUCKET: 'b',
            MEDIA_AZURE_CONTAINER: 'c',
            MEDIA_AZURE_CONNECTION_STRING: 'cs'
        };
        process.env = new Proxy(base as NodeJS.ProcessEnv, {
            get(target, key) {
                if (typeof key === 'string') {
                    read.add(key);
                }
                return Reflect.get(target, key);
            }
        });
        builders.allowedOrigins();
        builders.apiPublicUrl();
        builders.port();
        builders.trustProxy();
        builders.databaseUrl();
        builders.docsEnabled();
        builders.mcpEnabled();
        builders.webhooksFromEnv();
        builders.schemaBuilderFromEnv();
        builders.rootAdminFromEnv();
        builders.mailFromEnv(['smtp', 'console']);
        builders.oidcFromEnv();
        builders.githubFromEnv();
        builders.samlFromEnv();
        builders.ssoFromEnv();
        builders.localStorageFromEnv();
        builders.s3StorageFromEnv();
        builders.gcsStorageFromEnv();
        builders.azureStorageFromEnv();
        builders.vercelBlobStorageFromEnv();
        builders.directServeFromEnv();
        builders.copilotEnabled();
        builders.anthropicFromEnv();
        builders.openAiFromEnv();
        builders.copilotQuotasFromEnv();
        // Every read also asks for its `_FILE` twin; those are not variables
        // of their own. (`MEDIA_GCS_KEY_FILE` is: its twin is `…_FILE_FILE`.)
        return new Set(
            [...read].filter(
                (name) =>
                    !(name.endsWith('_FILE') && read.has(name.slice(0, -5)))
            )
        );
    }

    it('lists every variable a builder reads', () => {
        const listed = new Set(ENV_CATALOG.map((spec) => spec.name));
        const legacy = new Set([
            ...Object.values(RENAMED).flat(),
            'ALLOWED_ORIGINS',
            'MAIL_PROVIDER',
            'SMTP_HOST',
            'SMTP_PORT',
            'SMTP_SECURE',
            'SMTP_USER',
            'SMTP_PASSWORD',
            'SMTP_REQUIRE_TLS'
        ]);
        const unlisted = [...namesRead()].filter(
            (name) => !listed.has(name) && !legacy.has(name)
        );
        expect(unlisted).toEqual([]);
    });

    it('lists nothing the builders never read', () => {
        const read = namesRead();
        // Read by the admin's Vite config, not the server.
        const elsewhere = new Set(['ADMIN_PORT', 'API_PORT']);
        const unread = ENV_CATALOG.map((spec) => spec.name).filter(
            (name) => !read.has(name) && !elsewhere.has(name)
        );
        expect(unread).toEqual([]);
    });

    it('records every rename the readers honour, and no other', () => {
        const fromCatalog = Object.fromEntries(
            ENV_CATALOG.filter((spec) => spec.previously).map((spec) => [
                spec.name,
                spec.previously
            ])
        );
        expect(fromCatalog).toEqual(RENAMED);
    });

    it('never lists a retired variable as a current one', () => {
        for (const spec of ENV_CATALOG) {
            expect(RETIRED_ENV[spec.name]).toBeUndefined();
        }
    });

    it('gives every enum its values and every variable a summary', () => {
        for (const spec of ENV_CATALOG) {
            expect(spec.summary.length).toBeGreaterThan(0);
            if (spec.kind === 'enum') {
                expect(spec.values?.length).toBeGreaterThan(0);
            }
        }
    });
});
