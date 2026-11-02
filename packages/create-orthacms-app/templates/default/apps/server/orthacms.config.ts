/**
 * Typed configuration for this app.
 *
 * **Which environment variables exist, and how each is read, comes from
 * `@orthacms/config`** — the same builders the Ortha CMS repository's own
 * server uses, so this app reads exactly the variables its documentation
 * lists, and refuses a value it cannot honour instead of guessing. `config/`
 * composes those builders with what is **code**: session lifetimes, the login
 * rate limit, GraphQL cost budgets, retry counts, provider names. No module
 * here touches `process.env` directly. Every variable, its default and what it
 * means: `npx orthacms doctor`, or the comments in `.env`.
 *
 * **Shape:** one module per plugin under `config/`, each exporting a builder,
 * and this file assembling them. So the literal at the bottom is the table of
 * contents — what this app runs, in one screen — and a reader who wants to know
 * how one setting is derived opens the one module that owns it. Adding a setting
 * means editing one builder; adding a plugin means one module and one line here.
 *
 * Anything conditional is a *value* — a builder returns `undefined`
 * for a backend you did not configure, and `defined(…)` drops the keys that were
 * never set, so no config object here needs a `...(x ? { … } : {})` spread.
 *
 * This file stays the entry point rather than becoming another module in the
 * folder: `orthacms start` runs the compiled `dist/server/orthacms.config.js`, and
 * `src/plugins.ts` imports the types below.
 */
import { join } from 'node:path';
import type {
    ApiDocsOptions,
    TrustProxySetting
} from '@orthacms/bootstrap-server';
import type { I18nPluginConfig } from '@orthacms/i18n-server';
import type { SchemaBuilderPluginConfig } from '@orthacms/schema-builder-server';
import type { SegmentsPluginConfig } from '@orthacms/segments-server';
import type { TransferPluginConfig } from '@orthacms/transfer-server';
import type { WebhooksPluginConfig } from '@orthacms/webhooks-server';
// orthacms:if graphql
import type { ContentGraphqlPluginConfig } from '@orthacms/content-graphql';
// orthacms:end
// orthacms:if mcp
import type { McpPluginConfig } from '@orthacms/mcp-server';
// orthacms:end
import {
    checkRetiredEnv,
    databaseUrl,
    port,
    trustProxy
} from '@orthacms/config';

import { docsConfig } from './config/docs';
import { identityConfig, type AppIdentityConfig } from './config/identity';
import { i18nConfig } from './config/i18n';
import { mediaConfig, type AppMediaConfig } from './config/media';
import { copilotConfig, type AppCopilotConfig } from './config/copilot';
// orthacms:if mail
import { mailConfig, type AppMailConfig } from './config/mail';
// orthacms:end
import { segmentsConfig } from './config/segments';
import { transferConfig } from './config/transfer';
import { webhooksConfig } from './config/webhooks';
import { schemaBuilderConfig } from './config/schema-builder';
// orthacms:if graphql
import { contentGraphqlConfig } from './config/graphql';
// orthacms:end
// orthacms:if mcp
import { mcpConfig } from './config/mcp';
// orthacms:end

/**
 * Re-exported so `import type { AppCopilotConfig } from '../orthacms.config'`
 * keeps working. `src/plugins.ts` names these, and which file they are declared
 * in is an implementation detail of this one.
 */
export type { AppIdentityConfig, AppMediaConfig, AppCopilotConfig };
// orthacms:if mail
export type { AppMailConfig };
// orthacms:end

/** Root configuration for this app. */
export interface OrthaCmsConfig {
    port: number;
    globalPrefix: string;
    trustProxy?: TrustProxySetting;
    bodyLimit?: string | number;
    staticDir?: string;
    database: {
        url: string;
        /** Days a delivered outbox event is kept; `0` never prunes. */
        outboxRetentionDays: number;
    };
    docs: ApiDocsOptions;
    plugins: {
        identity: AppIdentityConfig;
        i18n: I18nPluginConfig;
        media: AppMediaConfig;
        copilot: AppCopilotConfig;
        // orthacms:if mail
        /**
         * Outgoing mail, or **absent** — `undefined` is the configuration of an
         * app that sends nothing, and the one it ships in. `src/plugins.ts`
         * registers the plugin only when this is present.
         */
        mail?: AppMailConfig;
        // orthacms:end
        /** Export/import — per-type identity fields and transfer ceilings. */
        transfer: TransferPluginConfig;
        /** Reader entitlements — where a reader's tags come from. */
        segments: SegmentsPluginConfig;
        /** Outgoing webhooks — delivery pacing and the URL policy. */
        webhooks: WebhooksPluginConfig;
        /**
         * The Content model page — whether editing is on (development only)
         * and where this app's source lives.
         */
        schemaBuilder: SchemaBuilderPluginConfig;
        // orthacms:if graphql
        /** Public GraphQL endpoint — the per-operation cost budget. */
        contentGraphql: ContentGraphqlPluginConfig;
        // orthacms:end
        // orthacms:if mcp
        mcp: McpPluginConfig;
        // orthacms:end
    };
}

// A variable that used to tune something here and is no longer read refuses
// to start when it holds anything but its old default — ignoring it would
// change this app without a word. Before any builder runs.
checkRetiredEnv();

const config: OrthaCmsConfig = {
    port: port(),
    globalPrefix: 'api',
    trustProxy: trustProxy(),
    // The largest JSON body the API parses. Media uploads are capped separately.
    bodyLimit: '1mb',
    staticDir: join(process.cwd(), 'dist/admin'),
    database: {
        url: databaseUrl('Set it in your .env, or run `npx orthacms setup`.'),
        // Days of delivered outbox history kept; 0 keeps everything.
        outboxRetentionDays: 30
    },
    docs: docsConfig(),
    plugins: {
        identity: identityConfig(),
        i18n: i18nConfig(),
        media: mediaConfig(),
        copilot: copilotConfig(),
        // orthacms:if mail
        mail: mailConfig(),
        // orthacms:end
        transfer: transferConfig(),
        segments: segmentsConfig(),
        webhooks: webhooksConfig(),
        schemaBuilder: schemaBuilderConfig(),
        // orthacms:if graphql
        contentGraphql: contentGraphqlConfig(),
        // orthacms:end
        // orthacms:if mcp
        mcp: mcpConfig()
        // orthacms:end
    }
};

export default config;
