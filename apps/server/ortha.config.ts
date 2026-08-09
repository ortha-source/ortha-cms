/**
 * Typed application configuration for the Ortha CMS server.
 *
 * This is the single place that reads `process.env`. Everything
 * downstream (`createServer`, plugins) receives typed config — nothing
 * else should reach for environment variables directly. Deploy-specific
 * values come from the environment; stable tuning lives here as literals.
 */

import type { ApiDocsOptions } from '@ortha-cms/bootstrap-server';
import type { CopilotPluginConfig } from '@ortha-cms/copilot-server';
import type { AnthropicProviderConfig } from '@ortha-cms/copilot-provider-anthropic';
import type { OpenAiProviderConfig } from '@ortha-cms/copilot-provider-openai';
import type { IdentityPluginConfig } from '@ortha-cms/identity-server';
import type { I18nPluginConfig } from '@ortha-cms/i18n-server';
import type { McpPluginConfig } from '@ortha-cms/mcp-server';
import type { MediaPluginConfig } from '@ortha-cms/media-server';

/**
 * Copilot settings, plus the connection settings for the model backends this
 * deployment can reach.
 *
 * The provider settings live **here**, not in `CopilotPluginConfig`: the
 * plugin is adapter-agnostic by decision (ADR-0004 §2), so it names no
 * provider kind. This file already imports the adapter factories in
 * `plugins.ts`, so importing their config types costs no new coupling — and
 * adding a fourth backend is a key here plus a line there, with nothing to
 * change inside the copilot packages.
 *
 * Each key is the name runs refer to the provider by. Register two of the same
 * kind freely (`ollamaFast`, `ollamaBig`); each declares its own model list.
 */
export interface OrthaCopilotConfig extends CopilotPluginConfig {
    /** Model backends, keyed by the name they are registered under. */
    providers: {
        /** Native Claude. */
        claude: AnthropicProviderConfig;
        /** An OpenAI-wire-format endpoint — Ollama by default. */
        ollama: OpenAiProviderConfig;
    };
}

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
    /** Database connection settings. */
    database: OrthaDatabaseConfig;
    /** OpenAPI document + Scalar API reference settings. */
    docs: ApiDocsOptions;
    /** Per-plugin runtime config, keyed by plugin name. */
    plugins: {
        /** Identity plugin settings. */
        identity: IdentityPluginConfig;
        /** i18n plugin settings — the available content locales. */
        i18n: I18nPluginConfig;
        /** Media plugin settings — storage providers + upload limits. */
        media: MediaPluginConfig;
        /** Copilot plugin settings — kill switch + model providers. */
        copilot: OrthaCopilotConfig;
        /** MCP plugin settings — kill switch + the identity clients see. */
        mcp: McpPluginConfig;
    };
}

const config: OrthaConfig = {
    port: Number(process.env['PORT']) || 3000,
    globalPrefix: 'api',
    database: {
        url: process.env['DATABASE_URL'] ?? ''
    },
    docs: {
        // On outside production, where the reference is a development tool.
        // `API_DOCS` overrides either way — set it to `true` to publish the
        // reference from a deployed instance.
        enabled: process.env['API_DOCS']
            ? process.env['API_DOCS'] === 'true'
            : process.env['NODE_ENV'] !== 'production',
        title: 'Ortha CMS API',
        version: '1.0.0',
        description: [
            'The Ortha CMS HTTP API, assembled from the plugins registered in',
            '`apps/server/src/plugins.ts`. Every route lives under the `/api`',
            'prefix and is authenticated by default — a browser session cookie',
            'from `POST /api/auth/login`, or a bearer API token for the',
            'external content API.',
            '',
            'Workspace-scoped routes (content, media, workspace members) also',
            'require an `X-Workspace-Id` header naming a workspace the caller',
            'is a member of.'
        ].join('\n')
    },
    plugins: {
        identity: {
            sessionSecret: process.env['SESSION_SECRET'] ?? '',
            tokenSecret: process.env['TOKEN_SECRET'] ?? '',
            // Origins allowed to call state-changing endpoints (login-CSRF
            // defense). Comma-separated; defaults to the dev admin origin.
            allowedOrigins: (
                process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:4200'
            )
                .split(',')
                .map((origin) => origin.trim())
                .filter(Boolean),
            session: {
                ttlSeconds:
                    Number(process.env['SESSION_TTL_SECONDS']) ||
                    60 * 60 * 24 * 7,
                cookieSecure: process.env['NODE_ENV'] === 'production',
                cookieSameSite: 'lax'
            },
            token: {
                inviteTtlSeconds:
                    Number(process.env['INVITE_TTL_SECONDS']) ||
                    60 * 60 * 24 * 7,
                resetTtlSeconds:
                    Number(process.env['RESET_TTL_SECONDS']) || 60 * 60
            },
            // Login rate limit. Defaults preserve the historical 10 req / 60s.
            rateLimit: {
                ttlSeconds:
                    Number(process.env['LOGIN_RATE_LIMIT_TTL_SECONDS']) || 60,
                limit: Number(process.env['LOGIN_RATE_LIMIT']) || 10
            },
            rootAdmin: {
                email: process.env['ORTHA_ROOT_ADMIN_EMAIL'] ?? '',
                password: process.env['ORTHA_ROOT_ADMIN_PASSWORD'] ?? '',
                name: process.env['ORTHA_ROOT_ADMIN_NAME'] ?? ''
            }
        },
        i18n: {
            // Content locales — stable product configuration, so literals
            // (like the rest of the non-secret tuning here). The slugs are
            // stored on entry rows; the migration backfill assumes 'en' is
            // the default.
            locales: [
                { slug: 'en', name: 'English', isDefault: true },
                { slug: 'de', name: 'Deutsch' },
                { slug: 'fr', name: 'Français' }
            ]
        },
        media: {
            // The provider the resolver falls back to when no custom handler is
            // supplied in `plugins.ts`. Deploy-specific; defaults to local disk.
            defaultProvider: process.env['MEDIA_PROVIDER'] ?? 'local',
            local: {
                // Blobs live under a git-ignored project dir by default; point
                // MEDIA_LOCAL_ROOT at a persistent volume for real deployments.
                rootDir: process.env['MEDIA_LOCAL_ROOT'] ?? './.storage/media',
                publicBasePath: '/api/media/assets'
            },
            s3: {
                bucket: process.env['MEDIA_S3_BUCKET'] ?? '',
                region: process.env['MEDIA_S3_REGION'] ?? ''
            },
            // Upload cap — 50 MB by default.
            maxUploadBytes:
                Number(process.env['MEDIA_MAX_UPLOAD_BYTES']) || 52_428_800
        },
        copilot: {
            // Off by default (ADR-0005 §10). Enabling a hosted provider sends
            // workspace content to a third party, so an operator opts in.
            enabled: process.env['COPILOT_ENABLED'] === 'true',
            // Which registered provider serves a run when `plugins.ts` supplies
            // no custom `resolve` handler. `fake` needs no key and no network,
            // so a fresh clone and CI both boot without configuration.
            defaultProvider: process.env['COPILOT_PROVIDER'] ?? 'fake',
            maxOutputTokens:
                Number(process.env['COPILOT_MAX_OUTPUT_TOKENS']) || 8_192,
            // Run ceilings. Only `maxSteps` is env-exposed, because it is the
            // one an operator actually reaches for: a smaller local model often
            // needs more tool round trips than a frontier one to answer the
            // same question, and a run that ends on "reached the maximum number
            // of steps" is usually asking for a higher number here. Raising it
            // costs tokens rather than safety — every step is still authorized,
            // audited, and bounded by the wall-clock and token ceilings.
            ...(Number(process.env['COPILOT_MAX_STEPS'])
                ? {
                      limits: {
                          maxSteps: Number(process.env['COPILOT_MAX_STEPS'])
                      }
                  }
                : {}),
            providers: {
                claude: {
                    apiKey: process.env['ANTHROPIC_API_KEY'] ?? '',
                    // Stable product configuration, so literals like the i18n
                    // locales. First is the default; the rest are what a user
                    // can switch to mid-conversation. Comma-separated env
                    // override for pinning a different set without a redeploy.
                    models: (
                        process.env['COPILOT_ANTHROPIC_MODELS'] ??
                        'claude-opus-5,claude-sonnet-5,claude-haiku-4-5'
                    )
                        .split(',')
                        .map((model) => model.trim())
                        .filter(Boolean),
                    ...(process.env['ANTHROPIC_BASE_URL']
                        ? { baseUrl: process.env['ANTHROPIC_BASE_URL'] }
                        : {})
                },
                ollama: {
                    // Defaults to a local Ollama, the common self-hosted setup
                    // — point it at vLLM, LiteLLM, Azure or OpenAI instead.
                    baseUrl:
                        process.env['COPILOT_OPENAI_BASE_URL'] ??
                        'http://localhost:11434/v1',
                    models: (process.env['COPILOT_OPENAI_MODELS'] ?? 'llama3.1')
                        .split(',')
                        .map((model) => model.trim())
                        .filter(Boolean),
                    apiKey: process.env['COPILOT_OPENAI_API_KEY'] ?? ''
                }
            }
        },
        mcp: {
            // Off by default, like the copilot's kill switch and for the same
            // reason: enabling it lets any holder of a `full`-scope API token
            // drive content CRUD from an external agent. That is a decision an
            // operator makes deliberately, not one they inherit from an
            // upgrade. Tokens, scopes, and workspace buckets are unchanged —
            // this only controls whether the MCP front door is mounted.
            enabled: process.env['MCP_ENABLED'] === 'true',
            // Stable product configuration, so literals: this is the identity
            // MCP clients display in their connector lists.
            name: 'ortha-cms',
            version: '1.0.0'
        }
    }
};

export default config;
