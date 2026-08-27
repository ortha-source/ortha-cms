/**
 * Typed configuration for this app.
 *
 * **The single place that reads `process.env`.** Everything downstream — the
 * host, every plugin — receives typed values, so "where does this setting come
 * from" has exactly one answer. Deploy-specific values come from the
 * environment; stable product tuning lives here as literals.
 *
 * **Shape:** one builder function per plugin, then a flat `config` literal that
 * calls them. The literal is the table of contents; a builder is where one
 * plugin's settings are derived. Anything conditional is a *value* — `when(…)`
 * for a whole block, `defined(…)` to drop the keys that were never set — so the
 * config object itself stays free of `...(x ? { … } : {})` spreads.
 */
import { join } from 'node:path';
import type {
    ApiDocsOptions,
    TrustProxySetting
} from '@orthacms/bootstrap-server';
import type { IdentityPluginConfig } from '@orthacms/identity-server';
// ortha:if sso-oidc
import type { OidcProviderConfig } from '@orthacms/identity-provider-oidc';
// ortha:end
import type { I18nPluginConfig } from '@orthacms/i18n-server';
import type { MediaPluginConfig } from '@orthacms/media-server';
// ortha:if media-local
import type { LocalStorageConfig } from '@orthacms/media-provider-local';
// ortha:end
// ortha:if media-s3
import type { S3StorageConfig } from '@orthacms/media-provider-s3';
// ortha:end
// ortha:if media-azure
import type { AzureStorageConfig } from '@orthacms/media-provider-azure';
// ortha:end
// ortha:if media-gcs
import type { GcsStorageConfig } from '@orthacms/media-provider-gcs';
// ortha:end
// ortha:if media-vercel-blob
import type { VercelBlobStorageConfig } from '@orthacms/media-provider-vercel-blob';
// ortha:end
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
 * Identity settings, plus the identity providers this app can reach.
 *
 * The provider settings live here rather than inside `IdentityPluginConfig`,
 * for the same reason the copilot's backends do: the plugin names no protocol,
 * and this file is the one place that reads the environment. The constructed
 * adapters are registered in `src/plugins.ts`.
 */
export interface AppIdentityConfig extends IdentityPluginConfig {
    /**
     * Identity providers, keyed by the name they are registered under. That
     * name appears in the sign-in URL and in every `sso_identities` row, so
     * renaming one orphans the links that name it.
     *
     * Optional, and absent unless this app was generated with single sign-on.
     */
    ssoProviders?: {
        // ortha:if sso-oidc
        /** A generic OpenID Connect provider. Present when both env vars are set. */
        oidc?: OidcProviderConfig & { name: string };
        // ortha:end
    };
}

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

/**
 * Media settings, plus whatever the storage backend `src/plugins.ts`
 * constructs needs. The two move together: the type below is the one exported
 * by the adapter that file imports.
 */
export interface AppMediaConfig extends MediaPluginConfig {
    // ortha:if media-local
    storage: LocalStorageConfig;
    // ortha:end
    // ortha:if media-s3
    storage: S3StorageConfig;
    // ortha:end
    // ortha:if media-azure
    storage: AzureStorageConfig;
    // ortha:end
    // ortha:if media-gcs
    storage: GcsStorageConfig;
    // ortha:end
    // ortha:if media-vercel-blob
    storage: VercelBlobStorageConfig;
    // ortha:end
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
        identity: AppIdentityConfig;
        i18n: I18nPluginConfig;
        media: AppMediaConfig;
        copilot: AppCopilotConfig;
        // ortha:if mcp
        mcp: McpPluginConfig;
        // ortha:end
    };
}

// ---------------------------------------------------------------------------
// Reading the environment
//
// Every reader returns a *value* — the setting, or `undefined` for "this
// deployment did not configure it". Nothing returns a fragment of an object, so
// nothing has to be spread conditionally at the call site.
// ---------------------------------------------------------------------------

/**
 * A trimmed environment value, `undefined` when unset **or empty**.
 *
 * The empty case matters: `.env.example` ships keys with no value, so `KEY=`
 * has to read the same as "not configured" — otherwise the app starts with an
 * empty API key instead of without a provider.
 */
function readEnv(name: string): string | undefined {
    return process.env[name]?.trim() || undefined;
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
    const raw = readEnv(name);
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
    const raw = readEnv(name);
    if (!raw) return fallback;

    if (!/^\d+$/.test(raw) || Number(raw) <= 0) {
        throw new Error(
            `Environment variable ${name} must be a positive whole number ` +
                `(got "${raw}").`
        );
    }
    return Number(raw);
}

/** A comma-separated list setting, trimmed and emptied of blanks. */
function readList(name: string, fallback: string): string[] {
    return (process.env[name] ?? fallback)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

/**
 * A boolean setting: what the deployment said, or `fallback` when it said
 * nothing. Anything other than `true` reads as false, so a typo turns a switch
 * off rather than on.
 */
function readFlag(name: string, fallback: boolean): boolean {
    const raw = readEnv(name);
    return raw === undefined ? fallback : raw === 'true';
}

/**
 * The value when the setting was configured, `undefined` when it was not.
 *
 * The counterpart to {@link defined}: together they replace
 * `...(x ? { key: … } : {})`. `build` is a thunk, so the body — often several
 * further reads — runs only when it applies.
 */
function when<T>(configured: unknown, build: () => T): T | undefined {
    return configured ? build() : undefined;
}

/**
 * The same object with every `undefined`-valued key removed.
 *
 * Plugins merge their defaults as `{ ...DEFAULTS, ...config }`, so an explicit
 * `{ key: undefined }` does not leave the default in place — it erases it.
 * Dropping the key is what "the deployment did not set this" has to mean.
 */
function defined<T extends object>(value: T): T {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
        if (item !== undefined) {
            result[key] = item;
        }
    }
    return result as T;
}

/**
 * Express's `trust proxy` setting: a hop count (the recommended form, and the
 * only one a client cannot forge past), a boolean, or a subnet/preset string
 * passed through verbatim. Unset leaves forwarded headers ignored.
 */
function trustProxy(): TrustProxySetting | undefined {
    const raw = readEnv('TRUST_PROXY');
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
const nodeEnv = readEnv('NODE_ENV');

if (nodeEnv && !(NODE_ENVS as readonly string[]).includes(nodeEnv)) {
    throw new Error(
        `NODE_ENV is "${nodeEnv}", which this app does not recognise — expected ` +
            `one of ${NODE_ENVS.join(', ')}, or nothing at all for local ` +
            'development. Anything else reads as "not production", which ' +
            'publishes the API reference and drops `Secure` from the session cookie.'
    );
}

const isProduction = nodeEnv === 'production';

// ---------------------------------------------------------------------------
// One builder per section
// ---------------------------------------------------------------------------

/** The OpenAPI document and the API reference it is served as. */
function docsConfig(): ApiDocsOptions {
    return {
        // On outside production, where the reference is a development tool.
        // `API_DOCS=true` publishes it from a deployed instance.
        enabled: readFlag('API_DOCS', !isProduction),
        title: '__APP_TITLE__ API',
        version: '1.0.0'
    };
}

/** Identity — sessions, tokens, the SSO handshake, and the first admin. */
function identityConfig(): AppIdentityConfig {
    return {
        // Origins allowed to make state-changing calls (login-CSRF defence).
        // In development that is the Vite dev server; in production the app is
        // same-origin, so this list is what a separately-hosted admin would
        // need adding to.
        allowedOrigins: readList(
            'ALLOWED_ORIGINS',
            `http://localhost:${readPositiveInt('ADMIN_PORT', 4200)}`
        ),
        session: {
            ttlSeconds: readPositiveInt('SESSION_TTL_SECONDS', 60 * 60 * 24 * 7),
            cookieSecure: isProduction,
            cookieSameSite: 'lax' as const
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
        sso: ssoConfig(),
        // ortha:if sso-oidc
        ssoProviders: defined({ oidc: oidcProvider() }),
        // ortha:end
        // With an email set, an admin is provisioned on boot — idempotent and
        // non-destructive. This is how you get your first login.
        rootAdmin: {
            email: process.env['ORTHA_ROOT_ADMIN_EMAIL'] ?? '',
            password: process.env['ORTHA_ROOT_ADMIN_PASSWORD'] ?? '',
            name: process.env['ORTHA_ROOT_ADMIN_NAME'] ?? ''
        }
    };
}

/**
 * The shape of the single sign-on handshake. The providers themselves are
 * constructed in `src/plugins.ts`; these settings say how the round trip runs.
 */
function ssoConfig(): NonNullable<IdentityPluginConfig['sso']> {
    return defined({
        // The origin browsers reach this API on. It builds the redirect_uri
        // you register with each provider, and it is configured rather than
        // read from the request's Host header, which a client controls. Leave
        // it unset when the admin and the API share an origin — the usual case.
        publicBaseUrl: readEnv('SSO_PUBLIC_BASE_URL'),
        requestTtlSeconds: readPositiveInt('SSO_REQUEST_TTL_SECONDS', 600)
    });
}

// ortha:if sso-oidc
/**
 * The OIDC provider, or nothing.
 *
 * Present only when both values are set: an issuer with no client id becomes a
 * sign-in button that can only fail, and every SSO failure looks the same, so
 * whoever clicks it learns nothing.
 */
function oidcProvider(): (OidcProviderConfig & { name: string }) | undefined {
    const issuer = readEnv('SSO_OIDC_ISSUER');
    const clientId = readEnv('SSO_OIDC_CLIENT_ID');
    return when(issuer && clientId, () =>
        defined({
            name: process.env['SSO_OIDC_NAME'] ?? 'oidc',
            issuer: issuer as string,
            clientId: clientId as string,
            clientSecret: readEnv('SSO_OIDC_CLIENT_SECRET'),
            label: readEnv('SSO_OIDC_LABEL'),
            // The only gate on a first sign-in claiming an existing account. A
            // provider that omits the claim — Entra ID, notably — links nobody
            // until an operator asserts that this directory owns the addresses
            // it reports.
            emailVerifiedWhenAbsent: readFlag(
                'SSO_OIDC_EMAIL_VERIFIED_WHEN_ABSENT',
                false
            )
        })
    );
}
// ortha:end

/** The content locales, and what to do about rows left in a removed one. */
function i18nConfig(): I18nPluginConfig {
    return {
        // Content locales. Stable product configuration, hence literals. The
        // slugs are stored on entry rows, so removing one hides its rows rather
        // than deleting them — which is what `orphanedLocales` is about below.
        locales: [{ slug: 'en', name: 'English', isDefault: true }],
        // Rows in a locale no longer listed above are intact and unreachable,
        // the worst shape for a silent failure. Fail the boot and put the
        // choice in front of whoever edited the array.
        orphanedLocales: 'fail'
    };
}

/** Media — the storage backend, plus how downloads and uploads are bounded. */
function mediaConfig(): AppMediaConfig {
    return {
        storage: mediaStorage(),
        // Redirect an already-authorized download straight to the storage
        // backend instead of streaming it through the app. Off unless asked
        // for, and only possible on a backend that can sign a URL — the plugin
        // refuses the combination at boot rather than proxying while the
        // operator believes otherwise.
        directServe:
            readEnv('MEDIA_DIRECT_SERVE') === 'signed-url'
                ? 'signed-url'
                : 'off',
        directServeTtlSeconds: readPositiveInt(
            'MEDIA_DIRECT_SERVE_TTL_SECONDS',
            300
        ),
        maxUploadBytes: readPositiveInt(
            'MEDIA_MAX_UPLOAD_BYTES',
            50 * 1024 * 1024
        )
    };
}

// ortha:if media-local
/** Local-filesystem blobs. */
function mediaStorage(): LocalStorageConfig {
    return {
        // Point MEDIA_LOCAL_ROOT at a persistent volume in production: a
        // container's own disk is wiped on every deploy.
        rootDir: process.env['MEDIA_LOCAL_ROOT'] ?? './.storage/media'
    };
}
// ortha:end
// ortha:if media-vercel-blob
/** Vercel Blob. */
function mediaStorage(): VercelBlobStorageConfig {
    return defined({
        // On Vercel the SDK reads BLOB_READ_WRITE_TOKEN itself, so this is only
        // for running the app elsewhere.
        token: readEnv('BLOB_READ_WRITE_TOKEN')
    });
}
// ortha:end
// ortha:if media-gcs
/** Google Cloud Storage. */
function mediaStorage(): GcsStorageConfig {
    return defined({
        bucket: requireEnv('MEDIA_GCS_BUCKET'),
        // Everything else is optional: with no key file and no inline
        // credentials the client uses Application Default Credentials, which is
        // what a GKE or Cloud Run deployment wants.
        projectId: readEnv('MEDIA_GCS_PROJECT_ID'),
        keyFilename: readEnv('MEDIA_GCS_KEY_FILE'),
        signWithIam: readFlag('MEDIA_GCS_SIGN_WITH_IAM', false)
    });
}
// ortha:end
// ortha:if media-azure
/** Azure Blob Storage. */
function mediaStorage(): AzureStorageConfig {
    return {
        container: requireEnv('MEDIA_AZURE_CONTAINER'),
        connectionString: requireEnv('MEDIA_AZURE_CONNECTION_STRING')
    };
}
// ortha:end
// ortha:if media-s3
/** S3 or an S3-compatible endpoint — R2, MinIO, Spaces, B2. */
function mediaStorage(): S3StorageConfig {
    const accessKeyId = readEnv('MEDIA_S3_ACCESS_KEY_ID');
    const secretAccessKey = readEnv('MEDIA_S3_SECRET_ACCESS_KEY');
    return defined({
        bucket: requireEnv('MEDIA_S3_BUCKET'),
        // `auto` is what R2 expects; AWS needs its real region.
        region: process.env['MEDIA_S3_REGION'] ?? 'auto',
        // Omit for AWS S3 itself; set it for R2, MinIO, Spaces, B2…
        endpoint: readEnv('MEDIA_S3_ENDPOINT'),
        forcePathStyle: readFlag('MEDIA_S3_FORCE_PATH_STYLE', false),
        // Absent means "use the SDK's own provider chain" — an instance role,
        // IRSA, a shared config file. Passing blanks instead would shadow all
        // of that with credentials that cannot sign.
        credentials: when(accessKeyId && secretAccessKey, () => ({
            accessKeyId: accessKeyId as string,
            secretAccessKey: secretAccessKey as string
        }))
    });
}
// ortha:end

/** The copilot kill switch and the model backends it can reach. */
function copilotConfig(): AppCopilotConfig {
    return {
        // Off by default: enabling a hosted provider sends workspace content to
        // a third party, which is an operator's decision to make explicitly.
        enabled: readFlag('COPILOT_ENABLED', false),
        maxOutputTokens: readPositiveInt('COPILOT_MAX_OUTPUT_TOKENS', 8192),
        providers: defined({
            // ortha:if copilot-anthropic
            claude: anthropicProvider(),
            // ortha:end
            // ortha:if copilot-openai
            openai: openAiProvider()
            // ortha:end
        })
    };
}

// ortha:if copilot-anthropic
/**
 * Native Claude, or nothing.
 *
 * Setting the key is what REGISTERS this backend — leave it empty and there is
 * no `claude` in the picker at all, rather than one that fails on the first
 * message.
 */
function anthropicProvider(): AnthropicProviderConfig | undefined {
    const apiKey = readEnv('ANTHROPIC_API_KEY');
    return when(apiKey, () => ({
        apiKey: apiKey as string,
        models: readList('COPILOT_ANTHROPIC_MODELS', 'claude-sonnet-5')
    }));
}
// ortha:end
// ortha:if copilot-openai
/**
 * An OpenAI-wire backend, or nothing. No default endpoint: an unset variable
 * means "this deployment has no such backend", not "assume one is running on
 * this laptop".
 */
function openAiProvider(): OpenAiProviderConfig | undefined {
    const baseUrl = readEnv('COPILOT_OPENAI_BASE_URL');
    return when(baseUrl, () => ({
        baseUrl: baseUrl as string,
        apiKey: process.env['COPILOT_OPENAI_API_KEY'] ?? '',
        models: readList('COPILOT_OPENAI_MODELS', 'llama3.1')
    }));
}
// ortha:end

// ortha:if mcp
/** The MCP front door — off unless an operator turns it on. */
function mcpConfig(): McpPluginConfig {
    return {
        // Off by default: once on, any holder of a full-scope API token can
        // drive content CRUD from an external agent.
        enabled: readFlag('MCP_ENABLED', false),
        // The identity MCP clients display in their connector lists.
        name: '__APP_NAME__',
        version: '1.0.0',
        // A request/response transport owes its caller an answer, and the tool
        // registry has no deadline of its own — so without this the only bound
        // on a `tools/call` is the query underneath it, and a blocked pool
        // turns one call into a socket held until the client gives up.
        callTimeoutMs: readPositiveInt('MCP_CALL_TIMEOUT_MS', 30_000),
        // Deliberately generous: the ceiling exists to stop a pathological
        // result being serialised several times over, not to shape normal use.
        // A result this large does not fit a model's context anyway.
        maxResultBytes: readPositiveInt('MCP_MAX_RESULT_BYTES', 4_194_304)
    };
}
// ortha:end

const config: OrthaConfig = {
    port: readPositiveInt('PORT', 3000),
    globalPrefix: 'api',
    trustProxy: trustProxy(),
    bodyLimit: readEnv('MAX_REQUEST_BODY') ?? '1mb',
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
    docs: docsConfig(),
    plugins: {
        identity: identityConfig(),
        i18n: i18nConfig(),
        media: mediaConfig(),
        copilot: copilotConfig(),
        // ortha:if mcp
        mcp: mcpConfig()
        // ortha:end
    }
};

export default config;
