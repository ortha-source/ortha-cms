/**
 * Typed configuration for this app.
 *
 * **The single place that reads `process.env`.** Everything downstream — the
 * host, every plugin — receives typed values, so "where does this setting come
 * from" has exactly one answer. Deploy-specific values come from the
 * environment; stable product tuning lives here as literals.
 */
import { join } from 'node:path';
import type {
    ApiDocsOptions,
    TrustProxySetting
} from '@orthacms/bootstrap-server';
import type { IdentityPluginConfig } from '@orthacms/identity-server';
import type { I18nPluginConfig } from '@orthacms/i18n-server';
import type { MediaPluginConfig } from '@orthacms/media-server';
import type { LocalStorageConfig } from '@orthacms/media-provider-local';
import type { CopilotPluginConfig } from '@orthacms/copilot-server';
// ortha:if copilot-anthropic
import type { AnthropicProviderConfig } from '@orthacms/copilot-provider-anthropic';
// ortha:end
// ortha:if copilot-openai
import type { OpenAiProviderConfig } from '@orthacms/copilot-provider-openai';
// ortha:end
// ortha:if mcp
import type { McpPluginConfig } from '@orthacms/mcp-server';
// ortha:end

/**
 * Copilot settings plus the backends this deployment can reach.
 *
 * The provider settings live **here**, not inside `CopilotPluginConfig`: the
 * plugin is adapter-agnostic by decision, so it names no provider kind. A key
 * is present only when the deployment configured that backend, and `plugins.ts`
 * registers exactly the ones that are — "configured" is a fact this file can
 * read, where a `defaultProvider` naming one of them could be misspelled or
 * point at a backend nobody registered.
 */
export interface AppCopilotConfig extends CopilotPluginConfig {
    providers: {
        // ortha:if copilot-anthropic
        /** Native Claude. Present when ANTHROPIC_API_KEY is set. */
        claude?: AnthropicProviderConfig;
        // ortha:end
        // ortha:if copilot-openai
        /**
         * An OpenAI-wire endpoint — Ollama, vLLM, LiteLLM, Azure or OpenAI.
         * Present when COPILOT_OPENAI_BASE_URL is set: an endpoint nobody
         * named is a backend that can only time out.
         */
        openai?: OpenAiProviderConfig;
        // ortha:end
    };
}

/** Root configuration for this app. */
export interface OrthaConfig {
    port: number;
    globalPrefix: string;
    trustProxy?: TrustProxySetting;
    bodyLimit?: string | number;
    staticDir?: string;
    database: { url: string };
    docs: ApiDocsOptions;
    plugins: {
        identity: IdentityPluginConfig;
        i18n: I18nPluginConfig;
        media: MediaPluginConfig & {
            /**
             * Settings for the storage backend `plugins.ts` constructs. Typed
             * by the factory it imports — swap `createLocalStorageProvider` for
             * another and this type swaps with it.
             */
            storage: LocalStorageConfig;
        };
        copilot: AppCopilotConfig;
        // ortha:if mcp
        mcp: McpPluginConfig;
        // ortha:end
    };
}

/**
 * Reads a value the app cannot run without, failing at load rather than
 * several seconds into boot.
 *
 * Allowed to default to `''`, a missing `DATABASE_URL` reaches `pg` as "use
 * the libpq defaults" — so the first query fails with whatever the local
 * environment happens to produce, and nothing in the message names the
 * variable nobody set.
 */
function requireEnv(name: string): string {
    const raw = process.env[name]?.trim();
    if (!raw) {
        throw new Error(
            `Missing required environment variable ${name}. ` +
                'Set it in your .env before starting the app.'
        );
    }
    return raw;
}

/**
 * A numeric setting: the default when unset, the value when it is a plain
 * positive integer, and an error otherwise.
 *
 * Deliberately not `Number(process.env[x]) || fallback`, which is wrong in
 * three directions and silent in all of them: `0` is falsy so it becomes the
 * default, a negative is truthy so it is accepted (a negative session TTL
 * issues every session already expired), and `1e9` parses.
 */
function readPositiveInt(name: string, fallback: number): number {
    const raw = process.env[name]?.trim();
    if (!raw) return fallback;

    if (!/^\d+$/.test(raw) || Number(raw) <= 0) {
        throw new Error(
            `Environment variable ${name} must be a positive whole number ` +
                `(got "${raw}").`
        );
    }
    return Number(raw);
}

/**
 * Express's `trust proxy` setting: a hop count (the recommended form, and the
 * only one a client cannot forge past), a boolean, or a subnet/preset string
 * passed through verbatim. Unset leaves forwarded headers ignored.
 */
function readTrustProxy(): TrustProxySetting | undefined {
    const raw = process.env['TRUST_PROXY']?.trim();
    if (!raw) return undefined;

    const hops = Number(raw);
    if (Number.isInteger(hops) && hops >= 0) return hops;
    if (raw === 'true' || raw === 'false') return raw === 'true';

    return raw;
}

/**
 * True only in a deployment that said so, spelling checked.
 *
 * This one comparison gates two protections at once — whether the API
 * reference is published, and whether the session cookie carries `Secure` — so
 * a typo silently turns both off and is indistinguishable from correct
 * configuration until you read a `Set-Cookie` header.
 */
const NODE_ENVS = ['development', 'test', 'production'] as const;
const nodeEnv = process.env['NODE_ENV']?.trim();

if (nodeEnv && !(NODE_ENVS as readonly string[]).includes(nodeEnv)) {
    throw new Error(
        `NODE_ENV is "${nodeEnv}", which this app does not recognise — expected ` +
            `one of ${NODE_ENVS.join(', ')}, or nothing at all for local ` +
            'development. Anything else reads as "not production", which ' +
            'publishes the API reference and drops `Secure` from the session cookie.'
    );
}

const isProduction = nodeEnv === 'production';

/** A comma-separated list setting, trimmed and emptied of blanks. */
function readList(name: string, fallback: string): string[] {
    return (process.env[name] ?? fallback)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}
// ortha:if copilot-anthropic
const anthropicApiKey = process.env['ANTHROPIC_API_KEY']?.trim();
// ortha:end
// ortha:if copilot-openai
const openAiBaseUrl = process.env['COPILOT_OPENAI_BASE_URL']?.trim();
// ortha:end

const config: OrthaConfig = {
    port: readPositiveInt('PORT', 3000),
    globalPrefix: 'api',
    trustProxy: readTrustProxy(),
    bodyLimit: process.env['MAX_REQUEST_BODY'] || '1mb',
    // The built admin bundle, served by this same process so the API and the
    // UI share one origin — which is what identity's httpOnly, SameSite=lax
    // session cookie needs. `ortha dev` uses Vite's proxy for the same effect.
    //
    // Relative to the app root: `ortha start` runs from there, and this path
    // must mean the same thing whether it is read from `dist/` or from source.
    staticDir: join(process.cwd(), 'dist/admin'),
    database: {
        url: requireEnv('DATABASE_URL')
    },
    docs: {
        // On outside production, where the reference is a development tool.
        // `API_DOCS=true` publishes it from a deployed instance.
        enabled: process.env['API_DOCS']
            ? process.env['API_DOCS'] === 'true'
            : !isProduction,
        title: '__APP_TITLE__ API',
        version: '1.0.0'
    },
    plugins: {
        identity: {
            // Origins allowed to make state-changing calls (login-CSRF
            // defence). In development that is the Vite dev server; in
            // production the app is same-origin, so this list is what a
            // separately-hosted admin would need adding to.
            allowedOrigins: (
                process.env['ALLOWED_ORIGINS'] ??
                `http://localhost:${readPositiveInt('ADMIN_PORT', 4200)}`
            )
                .split(',')
                .map((origin) => origin.trim())
                .filter(Boolean),
            session: {
                ttlSeconds: readPositiveInt(
                    'SESSION_TTL_SECONDS',
                    60 * 60 * 24 * 7
                ),
                cookieSecure: isProduction,
                cookieSameSite: 'lax'
            },
            token: {
                inviteTtlSeconds: readPositiveInt(
                    'INVITE_TTL_SECONDS',
                    60 * 60 * 24 * 7
                ),
                resetTtlSeconds: readPositiveInt('RESET_TTL_SECONDS', 60 * 60)
            },
            rateLimit: {
                ttlSeconds: readPositiveInt('LOGIN_RATE_LIMIT_TTL_SECONDS', 60),
                limit: readPositiveInt('LOGIN_RATE_LIMIT', 10)
            },
            // With an email set, an admin is provisioned on boot — idempotent
            // and non-destructive. This is how you get your first login.
            rootAdmin: {
                email: process.env['ORTHA_ROOT_ADMIN_EMAIL'] ?? '',
                password: process.env['ORTHA_ROOT_ADMIN_PASSWORD'] ?? '',
                name: process.env['ORTHA_ROOT_ADMIN_NAME'] ?? ''
            }
        },
        i18n: {
            // Content locales. Stable product configuration, hence literals.
            // The slugs are stored on entry rows, so removing one hides its
            // rows rather than deleting them — which is what `orphanedLocales`
            // is about below.
            locales: [{ slug: 'en', name: 'English', isDefault: true }],
            // Rows in a locale no longer listed above are intact and
            // unreachable, the worst shape for a silent failure. Fail the boot
            // and put the choice in front of whoever edited the array.
            orphanedLocales: 'fail'
        },
        media: {
            storage: {
                // Point MEDIA_LOCAL_ROOT at a persistent volume in production:
                // a container's own disk is wiped on every deploy.
                rootDir: process.env['MEDIA_LOCAL_ROOT'] ?? './.storage/media'
            },
            // ortha:if media-s3
            // Redirect an already-authorized download straight to the bucket
            // instead of streaming it through the app. Off unless asked for.
            directServe:
                process.env['MEDIA_DIRECT_SERVE'] === 'signed-url'
                    ? 'signed-url'
                    : 'off',
            directServeTtlSeconds: readPositiveInt(
                'MEDIA_DIRECT_SERVE_TTL_SECONDS',
                300
            ),
            // ortha:end
            maxUploadBytes: readPositiveInt(
                'MEDIA_MAX_UPLOAD_BYTES',
                50 * 1024 * 1024
            )
        }
        ,
        copilot: {
            // Off by default: enabling a hosted provider sends workspace
            // content to a third party, which is an operator's decision to make
            // explicitly.
            enabled: process.env['COPILOT_ENABLED'] === 'true',
            maxOutputTokens: readPositiveInt('COPILOT_MAX_OUTPUT_TOKENS', 8192),
            providers: {
                // ortha:if copilot-anthropic
                // Setting the key is what REGISTERS this backend — leave it
                // empty and there is no `claude` in the picker at all, rather
                // than one that fails on the first message.
                ...(anthropicApiKey
                    ? {
                          claude: {
                              apiKey: anthropicApiKey,
                              models: readList(
                                  'COPILOT_ANTHROPIC_MODELS',
                                  'claude-sonnet-5'
                              )
                          }
                      }
                    : {}),
                // ortha:end
                // ortha:if copilot-openai
                ...(openAiBaseUrl
                    ? {
                          openai: {
                              baseUrl: openAiBaseUrl,
                              apiKey: process.env['COPILOT_OPENAI_API_KEY'] ?? '',
                              models: readList(
                                  'COPILOT_OPENAI_MODELS',
                                  'llama3.1'
                              )
                          }
                      }
                    : {})
                // ortha:end
            }
        }
        // ortha:if mcp
        ,
        mcp: {
            // Off by default: once on, any holder of a full-scope API token can
            // drive content CRUD from an external agent.
            enabled: process.env['MCP_ENABLED'] === 'true',
            // The identity MCP clients display in their connector lists.
            name: '__APP_NAME__',
            version: '1.0.0',
            // A request/response transport owes its caller an answer, and the
            // tool registry has no deadline of its own — so without this the
            // only bound on a `tools/call` is the query underneath it, and a
            // blocked pool turns one call into a socket held until the client
            // gives up.
            callTimeoutMs: readPositiveInt('MCP_CALL_TIMEOUT_MS', 30_000),
            // Deliberately generous: the ceiling exists to stop a pathological
            // result being serialised several times over, not to shape normal
            // use. A result this large does not fit a model's context anyway.
            maxResultBytes: readPositiveInt('MCP_MAX_RESULT_BYTES', 4_194_304)
        }
        // ortha:end
    }
};

export default config;
