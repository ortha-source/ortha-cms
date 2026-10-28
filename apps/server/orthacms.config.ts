/**
 * Typed application configuration for the Ortha CMS server.
 *
 * **Which environment variables exist, and how each is read, is not decided in
 * this app.** `@orthacms/config` holds the catalog — every variable, its
 * default, what it means — and the builders that read them; the scaffolder's
 * template calls the same builders, so a generated app reads exactly the
 * variables this one does, and `.env.example`, `env.tmpl` and
 * `docs/configuration.md` are generated from the catalog. `config/` composes
 * those builders with what is **code** here: lifetimes, rate limits, GraphQL
 * cost budgets, retry counts, provider names — settings no deployment needs to
 * vary per environment, and which would change in silence if a variable set by
 * accident could move them. No module in `config/` touches `process.env`
 * itself, which `src/orthacms.config.spec.ts` enforces.
 *
 * **Shape:** one module per plugin under `config/`, each exporting a builder,
 * and this file assembling them into one object. So the literal below is the
 * table of contents — what this deployment runs, in one screen — and a reader
 * who wants to know how a setting is derived opens the one module that owns it.
 * Anything conditional is a *value* inside a builder (`when`, `defined`), never
 * a `...(x ? { key } : {})` spread in the middle of the object it configures.
 *
 * This file stays the entry point rather than becoming another module in the
 * folder: `@orthacms/cli` looks for exactly `dist/server/orthacms.config.js`
 * (`LAYOUT.compiledConfig`), `@orthacms/nx` infers the migration targets onto
 * the project that has an `orthacms.config.ts`, and the types below are imported
 * from here by `src/plugins.ts` and by `apps/server-e2e`.
 */

import type {
    ApiDocsOptions,
    TrustProxySetting
} from '@orthacms/bootstrap-server';
import type { I18nPluginConfig } from '@orthacms/i18n-server';
import type { ContentGraphqlPluginConfig } from '@orthacms/content-graphql';
import type { McpPluginConfig } from '@orthacms/mcp-server';
import type { TransferPluginConfig } from '@orthacms/transfer-server';
import type { SchemaBuilderPluginConfig } from '@orthacms/schema-builder-server';
import type { SegmentsPluginConfig } from '@orthacms/segments-server';
import type { WebhooksPluginConfig } from '@orthacms/webhooks-server';
import { checkRetiredEnv, databaseUrl, port } from '@orthacms/config';

import { bodyLimit, trustProxy } from './config/server';
import { docsConfig } from './config/docs';
import { identityConfig, type OrthaCmsIdentityConfig } from './config/identity';
import { i18nConfig } from './config/i18n';
import { mediaConfig, type OrthaCmsMediaConfig } from './config/media';
import { copilotConfig, type OrthaCmsCopilotConfig } from './config/copilot';
import { contentGraphqlConfig } from './config/graphql';
import { mcpConfig } from './config/mcp';
import { transferConfig } from './config/transfer';
import { schemaBuilderConfig } from './config/schema-builder';
import { segmentsConfig } from './config/segments';
import { webhooksConfig } from './config/webhooks';
import { mailConfig, type OrthaCmsMailConfig } from './config/mail';

/**
 * Re-exported so `import type { OrthaCmsIdentityConfig } from '../orthacms.config'`
 * keeps working. `src/plugins.ts` and `apps/server-e2e` name these types, and
 * the file they are declared in is an implementation detail of this one.
 */
export type {
    OrthaCmsIdentityConfig,
    OrthaCmsMediaConfig,
    OrthaCmsCopilotConfig,
    OrthaCmsMailConfig
};

/** Database connection settings. */
export interface OrthaCmsDatabaseConfig {
    /** PostgreSQL connection string. Sourced from `DATABASE_URL`. */
    url: string;
    /**
     * How long a delivered outbox event is kept, in days; `0` never prunes.
     */
    outboxRetentionDays: number;
}

/** Root server configuration. */
export interface OrthaCmsConfig {
    /** Port the API listens on. Sourced from `PORT`, defaults to 3000. */
    port: number;
    /** Global API route prefix. */
    globalPrefix: string;
    /**
     * How many reverse proxies sit in front of the app, sourced from
     * `TRUST_PROXY`. Undefined when unset, which is what a directly-exposed
     * deployment wants; behind a load balancer it must be set or every client
     * shares one rate-limit bucket.
     */
    trustProxy?: TrustProxySetting;
    /**
     * Cap on a JSON / urlencoded request body. 1 MB — see `config/server.ts`.
     */
    bodyLimit?: string | number;
    /** Database connection settings. */
    database: OrthaCmsDatabaseConfig;
    /** OpenAPI document + Scalar API reference settings. */
    docs: ApiDocsOptions;
    /** Per-plugin runtime config, keyed by plugin name. */
    plugins: {
        /** Identity plugin settings — sessions, tokens, and SSO providers. */
        identity: OrthaCmsIdentityConfig;
        /** i18n plugin settings — the available content locales. */
        i18n: I18nPluginConfig;
        /** Media plugin settings — the storage backend + upload limits. */
        media: OrthaCmsMediaConfig;
        /** Copilot plugin settings — kill switch + model providers. */
        copilot: OrthaCmsCopilotConfig;
        /** Public GraphQL endpoint settings — the per-operation cost budget. */
        contentGraphql: ContentGraphqlPluginConfig;
        /** MCP plugin settings — kill switch + the identity clients see. */
        mcp: McpPluginConfig;
        /** Transfer plugin settings — per-type identity fields + transfer ceilings. */
        transfer: TransferPluginConfig;
        /** Segments plugin settings — where a reader's tags come from. */
        segments: SegmentsPluginConfig;
        /** Webhooks plugin settings — delivery pacing and the URL policy. */
        webhooks: WebhooksPluginConfig;
        /**
         * Schema builder settings — whether editing is on (development only,
         * ADR-0020) and where this app's source lives.
         */
        schemaBuilder: SchemaBuilderPluginConfig;
        /**
         * Mail plugin settings — the sender, the app URL every link is built
         * from, and the backend `plugins.ts` constructs.
         *
         * **`undefined` is the default and a complete configuration**: with no
         * `MAIL_URL` set the host registers no mail plugin, nothing is
         * sent, and the invite and reset routes keep returning the raw token
         * for an administrator to relay (ADR-0018).
         */
        mail?: OrthaCmsMailConfig;
    };
}

// A variable that used to tune something here and is no longer read refuses
// to load when it holds anything but its old default — ignoring it would
// change this deployment without a word. Before any builder runs.
checkRetiredEnv();

const config: OrthaCmsConfig = {
    port: port(),
    globalPrefix: 'api',
    trustProxy: trustProxy(),
    bodyLimit: bodyLimit(),
    database: {
        url: databaseUrl(
            'Copy `.env.example` to `.env` and set it (see `README.md`); ' +
                'the server has no usable default for this value.'
        ),
        // Days of delivered outbox history kept, `0` for "keep everything".
        // A pending or parked event is never deleted by age.
        outboxRetentionDays: 30
    },
    docs: docsConfig(),
    plugins: {
        identity: identityConfig(),
        i18n: i18nConfig(),
        transfer: transferConfig(),
        segments: segmentsConfig(),
        webhooks: webhooksConfig(),
        schemaBuilder: schemaBuilderConfig(),
        mail: mailConfig(),
        media: mediaConfig(),
        contentGraphql: contentGraphqlConfig(),
        copilot: copilotConfig(),
        mcp: mcpConfig()
    }
};

export default config;
