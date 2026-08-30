/**
 * Typed application configuration for the Ortha CMS server.
 *
 * `config/` is the single place that reads `process.env` — and `config/env.ts`
 * the only file in it that touches `process.env` directly. Everything
 * downstream (`createServer`, plugins) receives typed config; nothing else
 * should reach for environment variables. Deploy-specific values come from the
 * environment; stable tuning lives in the builders as literals.
 *
 * **Shape:** one module per plugin under `config/`, each exporting a builder,
 * and this file assembling them into one object. So the literal below is the
 * table of contents — what this deployment runs, in one screen — and a reader
 * who wants to know how a setting is derived opens the one module that owns it.
 * Anything conditional is a *value* inside a builder (`when`, `defined`), never
 * a `...(x ? { key } : {})` spread in the middle of the object it configures.
 *
 * This file stays the entry point rather than becoming another module in the
 * folder: `@orthacms/cli` looks for exactly `dist/server/ortha.config.js`
 * (`LAYOUT.compiledConfig`), `@orthacms/nx` infers the migration targets onto
 * the project that has an `ortha.config.ts`, and the types below are imported
 * from here by `src/plugins.ts` and by `apps/server-e2e`.
 *
 * *How* a value is parsed is not decided in this folder at all: the readers
 * come from `@orthacms/utils-server`, shared with the scaffolder's template so
 * a generated app validates its environment exactly as this one does. `config/`
 * names the variables and their defaults; the readers decide what a value has
 * to look like to be honoured, and refuse it otherwise.
 */

import type {
    ApiDocsOptions,
    TrustProxySetting
} from '@orthacms/bootstrap-server';
import type { I18nPluginConfig } from '@orthacms/i18n-server';
import type { ContentGraphqlPluginConfig } from '@orthacms/content-graphql';
import type { McpPluginConfig } from '@orthacms/mcp-server';
import type { TransferPluginConfig } from '@orthacms/transfer-server';
import type { SegmentsPluginConfig } from '@orthacms/segments-server';
import type { WebhooksPluginConfig } from '@orthacms/webhooks-server';
import { readPositiveInt, requireEnv } from '@orthacms/utils-server';

import { bodyLimit, trustProxy } from './config/server';
import { docsConfig } from './config/docs';
import { identityConfig, type OrthaIdentityConfig } from './config/identity';
import { i18nConfig } from './config/i18n';
import { mediaConfig, type OrthaMediaConfig } from './config/media';
import { copilotConfig, type OrthaCopilotConfig } from './config/copilot';
import { contentGraphqlConfig } from './config/graphql';
import { mcpConfig } from './config/mcp';
import { transferConfig } from './config/transfer';
import { segmentsConfig } from './config/segments';
import { webhooksConfig } from './config/webhooks';

/**
 * Re-exported so `import type { OrthaIdentityConfig } from '../ortha.config'`
 * keeps working. `src/plugins.ts` and `apps/server-e2e` name these types, and
 * the file they are declared in is an implementation detail of this one.
 */
export type { OrthaIdentityConfig, OrthaMediaConfig, OrthaCopilotConfig };

/** Database connection settings. */
export interface OrthaDatabaseConfig {
    /** PostgreSQL connection string. Sourced from `DATABASE_URL`. */
    url: string;
}

/** Root server configuration. */
export interface OrthaConfig {
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
     * Cap on a JSON / urlencoded request body, sourced from
     * `MAX_REQUEST_BODY`. Defaults to 1 MB — see `config/server.ts`.
     */
    bodyLimit?: string | number;
    /** Database connection settings. */
    database: OrthaDatabaseConfig;
    /** OpenAPI document + Scalar API reference settings. */
    docs: ApiDocsOptions;
    /** Per-plugin runtime config, keyed by plugin name. */
    plugins: {
        /** Identity plugin settings — sessions, tokens, and SSO providers. */
        identity: OrthaIdentityConfig;
        /** i18n plugin settings — the available content locales. */
        i18n: I18nPluginConfig;
        /** Media plugin settings — the storage backend + upload limits. */
        media: OrthaMediaConfig;
        /** Copilot plugin settings — kill switch + model providers. */
        copilot: OrthaCopilotConfig;
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
    };
}

const config: OrthaConfig = {
    port: readPositiveInt('PORT', 3000),
    globalPrefix: 'api',
    trustProxy: trustProxy(),
    bodyLimit: bodyLimit(),
    database: {
        url: requireEnv(
            'DATABASE_URL',
            'Copy `.env.example` to `.env` and set it (see `README.md`); ' +
                'the server has no usable default for this value.'
        )
    },
    docs: docsConfig(),
    plugins: {
        identity: identityConfig(),
        i18n: i18nConfig(),
        transfer: transferConfig(),
        segments: segmentsConfig(),
        webhooks: webhooksConfig(),
        media: mediaConfig(),
        contentGraphql: contentGraphqlConfig(),
        copilot: copilotConfig(),
        mcp: mcpConfig()
    }
};

export default config;
