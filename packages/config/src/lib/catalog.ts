/**
 * Every environment variable an Ortha CMS server reads, in one list.
 *
 * The builders in this package read exactly these names and nothing else
 * (`catalog.spec.ts` checks both directions), and everything that has to
 * describe the environment is generated from here rather than written by hand:
 * the repository's `.env.example`, the scaffolder's `env.tmpl`,
 * `docs/configuration.md`, `orthacms doctor` and `orthacms setup`. A setting
 * documented in one of those and read by nothing — or read and documented
 * nowhere — was the drift this list exists to end.
 */

/** Where a variable is listed. Groups are the sections of `.env.example`. */
export type EnvGroup =
    | 'core'
    | 'database'
    | 'admin'
    | 'storage'
    | 'mail'
    | 'sso'
    | 'copilot'
    | 'switches'
    | 'development';

/** What a value has to look like. Decides which reader the builders use. */
export type EnvKind =
    | 'string'
    | 'secret'
    | 'url'
    | 'int'
    | 'flag'
    | 'enum'
    | 'list'
    | 'path';

/** One environment variable. */
export interface EnvVarSpec {
    /** The variable's name. */
    readonly name: string;
    /** The `.env.example` section it is listed under. */
    readonly group: EnvGroup;
    /** What a value has to look like. */
    readonly kind: EnvKind;
    /** One sentence: what it is. */
    readonly summary: string;
    /** Anything a reader must know before setting it. Plain sentences. */
    readonly details?: string;
    /** The values an `enum` accepts. */
    readonly values?: readonly string[];
    /** What applies when it is unset, as written in a `.env` file. */
    readonly default?: string;
    /** An illustrative value, shown commented out where there is no default. */
    readonly example?: string;
    /**
     * When it must be set: `always`, only with `NODE_ENV=production`, or
     * whenever the feature it belongs to is installed.
     */
    readonly required?: 'always' | 'production' | 'feature';
    /**
     * The scaffolder features that read it. Absent means every app reads it.
     * Ids are `create-orthacms-app`'s (`media-s3`, `sso-oidc`, …) plus its two
     * group flags, `sso` and `mail`, and `workspace` for what only the CMS's
     * own repository reads.
     */
    readonly features?: readonly string[];
    /** Names it used to have, still read with a warning. */
    readonly previously?: readonly string[];
}

/** The section headings, in the order `.env.example` lists them. */
export const ENV_GROUPS: Readonly<Record<EnvGroup, string>> = {
    core: 'Server',
    database: 'Database',
    admin: 'First administrator',
    storage: 'Uploads',
    mail: 'Mail',
    sso: 'Single sign-on',
    copilot: 'Copilot',
    switches: 'Switches',
    development: 'Development only'
};

const STORAGE_THAT_SIGNS = ['media-s3', 'media-gcs', 'media-azure'] as const;

/** Every variable, in `.env.example` order. */
export const ENV_CATALOG: readonly EnvVarSpec[] = [
    // --- core -------------------------------------------------------------
    {
        name: 'NODE_ENV',
        group: 'core',
        kind: 'enum',
        values: ['development', 'test', 'production'],
        required: 'production',
        example: 'production',
        summary: 'The deployment mode.',
        details:
            'Spelled exactly. Anything but production publishes the API reference and drops Secure from the session cookie, so a typo refuses to start rather than reading as "not production". Unset is the ordinary local state.'
    },
    {
        name: 'PORT',
        group: 'core',
        kind: 'int',
        default: '3000',
        summary: 'The port the server listens on.'
    },
    {
        name: 'PUBLIC_URL',
        group: 'core',
        kind: 'url',
        required: 'production',
        example: 'https://cms.example.com',
        previously: ['APP_URL'],
        summary: 'The address people open the admin on.',
        details:
            'The allowed origin for sign-in, the SSO callback URLs and every link in an email are built from it. Outside production it defaults to http://localhost:<ADMIN_PORT>; in production the server refuses to start without it.'
    },
    {
        name: 'EXTRA_ORIGINS',
        group: 'core',
        kind: 'list',
        example: 'https://admin.example.com',
        summary:
            'More origins allowed to sign in, comma-separated, when the admin is also served from another address.'
    },
    {
        name: 'API_PUBLIC_URL',
        group: 'core',
        kind: 'url',
        previously: ['SSO_PUBLIC_BASE_URL'],
        summary:
            'The address browsers reach the API on, when it is not PUBLIC_URL.',
        details:
            'Only for an API on its own origin. SSO callback URLs are built from it, and from PUBLIC_URL when it is unset.'
    },
    {
        name: 'TRUST_PROXY',
        group: 'core',
        kind: 'string',
        example: '1',
        summary:
            'How many reverse proxies sit in front of the server. Required behind a load balancer, ingress or CDN.',
        details:
            'Required behind a load balancer, ingress or CDN: unset, every request reports the proxy address and the login rate limit becomes one bucket for everyone. Prefer the hop count; true or a subnet list are passed to Express as they are. Leave unset when the server is exposed directly.'
    },
    {
        name: 'ORTHACMS_WORKERS',
        group: 'core',
        kind: 'flag',
        default: 'true',
        summary: 'Whether this process sends webhooks and mail.',
        details:
            'Set false on web nodes when a separate process does the sending: deliveries still queue, and the worker picks them up. Some process must run with it on.'
    },
    // --- database ---------------------------------------------------------
    {
        name: 'DATABASE_URL',
        group: 'database',
        kind: 'secret',
        required: 'always',
        example: 'postgresql://orthacms:orthacms@localhost:5432/orthacms',
        summary: 'The PostgreSQL connection string.'
    },
    // --- first administrator ---------------------------------------------
    {
        name: 'ORTHACMS_ROOT_ADMIN_EMAIL',
        group: 'admin',
        kind: 'string',
        summary:
            'An administrator to create on boot, when no account has this address.',
        details:
            'Idempotent and non-destructive: an existing account is left alone. `orthacms setup` creates the first admin without it; use it where nothing interactive runs.'
    },
    {
        name: 'ORTHACMS_ROOT_ADMIN_PASSWORD',
        group: 'admin',
        kind: 'secret',
        summary: "That administrator's password. Hashed before it is stored."
    },
    {
        name: 'ORTHACMS_ROOT_ADMIN_NAME',
        group: 'admin',
        kind: 'string',
        summary: "That administrator's display name."
    },
    // --- uploads ----------------------------------------------------------
    {
        name: 'MEDIA_LOCAL_ROOT',
        group: 'storage',
        kind: 'path',
        default: './.storage/media',
        features: ['media-local'],
        summary: 'The directory uploads are written to.',
        details:
            "Point it at a persistent volume in production: a container's own disk is wiped on every deploy."
    },
    {
        name: 'MEDIA_S3_BUCKET',
        group: 'storage',
        kind: 'string',
        required: 'feature',
        features: ['media-s3'],
        summary: 'The S3 bucket uploads land in.'
    },
    {
        name: 'MEDIA_S3_ENDPOINT',
        group: 'storage',
        kind: 'url',
        features: ['media-s3'],
        example: 'https://<account>.r2.cloudflarestorage.com',
        summary:
            'The endpoint, for anything but AWS S3 itself: R2, MinIO, Spaces, B2, Wasabi.'
    },
    {
        name: 'MEDIA_S3_REGION',
        group: 'storage',
        kind: 'string',
        default: 'auto',
        features: ['media-s3'],
        summary: 'The region. AWS needs its real one; R2 takes auto.'
    },
    {
        name: 'MEDIA_S3_FORCE_PATH_STYLE',
        group: 'storage',
        kind: 'flag',
        default: 'false',
        features: ['media-s3'],
        summary: 'Path-style bucket addressing. MinIO needs it.'
    },
    {
        name: 'MEDIA_S3_ACCESS_KEY_ID',
        group: 'storage',
        kind: 'string',
        features: ['media-s3'],
        summary: 'The access key.',
        details:
            'Leave both keys unset on a host with an instance role or IRSA: the SDK finds those itself, and keys here would take their place.'
    },
    {
        name: 'MEDIA_S3_SECRET_ACCESS_KEY',
        group: 'storage',
        kind: 'secret',
        features: ['media-s3'],
        summary: 'The secret key.'
    },
    {
        name: 'MEDIA_GCS_BUCKET',
        group: 'storage',
        kind: 'string',
        required: 'feature',
        features: ['media-gcs'],
        summary: 'The Cloud Storage bucket uploads land in.'
    },
    {
        name: 'MEDIA_GCS_PROJECT_ID',
        group: 'storage',
        kind: 'string',
        features: ['media-gcs'],
        summary:
            'The project. Leave unset on GKE or Cloud Run, where Application Default Credentials apply.'
    },
    {
        name: 'MEDIA_GCS_KEY_FILE',
        group: 'storage',
        kind: 'path',
        features: ['media-gcs'],
        summary:
            'A service-account key file, when not using Application Default Credentials.'
    },
    {
        name: 'MEDIA_GCS_SIGN_WITH_IAM',
        group: 'storage',
        kind: 'flag',
        default: 'false',
        features: ['media-gcs'],
        summary:
            'Sign URLs through IAM instead of a private key (Workload Identity).',
        details: 'Needs the iam.serviceAccounts.signBlob permission.'
    },
    {
        name: 'MEDIA_AZURE_CONTAINER',
        group: 'storage',
        kind: 'string',
        required: 'feature',
        example: 'media',
        features: ['media-azure'],
        summary: 'The blob container uploads land in.'
    },
    {
        name: 'MEDIA_AZURE_CONNECTION_STRING',
        group: 'storage',
        kind: 'secret',
        required: 'feature',
        features: ['media-azure'],
        summary: 'The storage account connection string.',
        details:
            'For a managed identity, build the container client in plugins.ts instead — see the package docs.'
    },
    {
        name: 'BLOB_READ_WRITE_TOKEN',
        group: 'storage',
        kind: 'secret',
        features: ['media-vercel-blob'],
        summary:
            'The Vercel Blob token. Vercel sets it on its own platform; set it only elsewhere.',
        details:
            'Every blob in the store gets a permanent public URL: anyone who has one can fetch the file without signing in.'
    },
    {
        name: 'MEDIA_DIRECT_SERVE',
        group: 'storage',
        kind: 'enum',
        values: ['off', 'signed-url'],
        default: 'off',
        features: STORAGE_THAT_SIGNS,
        summary:
            'off streams every download through the server; signed-url redirects an authorised download to the storage backend.'
    },
    // --- mail -------------------------------------------------------------
    {
        name: 'MAIL_URL',
        group: 'mail',
        kind: 'secret',
        features: ['mail'],
        example: 'smtp://user:password@smtp.example.com:587',
        summary:
            'Where messages are handed off. Unset, the server sends nothing.',
        details:
            'smtp:// upgrades with STARTTLS (port 587), smtps:// is implicit TLS (465); add ?requireTls=true to refuse a relay that cannot upgrade. console:// writes messages to the log, for development only. With no mail, the invite and reset routes return the link for an administrator to pass on; with mail they stop returning it.'
    },
    {
        name: 'MAIL_FROM',
        group: 'mail',
        kind: 'string',
        required: 'feature',
        features: ['mail'],
        example: 'Ortha CMS <no-reply@example.com>',
        summary: 'The sender. Required once MAIL_URL is set.'
    },
    {
        name: 'MAIL_REPLY_TO',
        group: 'mail',
        kind: 'string',
        features: ['mail'],
        summary: 'Where replies go, when not MAIL_FROM.'
    },
    {
        name: 'MAIL_PRODUCT_NAME',
        group: 'mail',
        kind: 'string',
        default: 'Ortha CMS',
        features: ['mail'],
        summary: 'What the messages call the product.'
    },
    {
        name: 'MAIL_REVEAL_LINKS',
        group: 'mail',
        kind: 'flag',
        default: 'false',
        features: ['mail'],
        summary:
            'Also return invite and reset links in API responses. For chasing a message that did not arrive; turn it off again.'
    },
    // --- single sign-on ---------------------------------------------------
    {
        name: 'SSO_OIDC_ISSUER',
        group: 'sso',
        kind: 'url',
        features: ['sso-oidc'],
        example: 'https://example.okta.com',
        summary:
            'The OpenID Connect issuer. With a client id, it is what turns the provider on.',
        details:
            'Must match the iss claim byte for byte, trailing slash included. Register <PUBLIC_URL>/api/auth/sso/oidc/callback with the provider.'
    },
    {
        name: 'SSO_OIDC_CLIENT_ID',
        group: 'sso',
        kind: 'string',
        features: ['sso-oidc'],
        summary: 'The OpenID Connect client id.'
    },
    {
        name: 'SSO_OIDC_CLIENT_SECRET',
        group: 'sso',
        kind: 'secret',
        features: ['sso-oidc'],
        summary:
            'The client secret. Leave unset for a public client, which uses PKCE alone.'
    },
    {
        name: 'SSO_OIDC_EMAIL_VERIFIED_WHEN_ABSENT',
        group: 'sso',
        kind: 'flag',
        default: 'false',
        features: ['sso-oidc'],
        summary:
            'Treat addresses as verified when the provider sends no email_verified claim.',
        details:
            'Microsoft Entra ID is the common case. That claim is the only gate on a first sign-in claiming an existing account, so setting this asserts your directory owns the addresses it reports.'
    },
    {
        name: 'SSO_GITHUB_CLIENT_ID',
        group: 'sso',
        kind: 'string',
        features: ['sso-github'],
        summary: 'The GitHub OAuth app client id.',
        details:
            'Register <PUBLIC_URL>/api/auth/sso/github/callback as the callback URL.'
    },
    {
        name: 'SSO_GITHUB_CLIENT_SECRET',
        group: 'sso',
        kind: 'secret',
        features: ['sso-github'],
        summary:
            'The client secret. Required: GitHub has no PKCE, so it is what proves the code is redeemed by this app.'
    },
    {
        name: 'SSO_GITHUB_ENTERPRISE_URL',
        group: 'sso',
        kind: 'url',
        features: ['sso-github'],
        example: 'https://github.example.com',
        previously: ['SSO_GITHUB_ENTERPRISE_BASE_URL'],
        summary: 'A GitHub Enterprise Server root. Unset for github.com.'
    },
    {
        name: 'SSO_SAML_ENTRY_POINT',
        group: 'sso',
        kind: 'url',
        features: ['sso-saml'],
        summary:
            "The identity provider's single sign-on URL. With the certificate, it is what turns SAML on."
    },
    {
        name: 'SSO_SAML_IDP_CERT',
        group: 'sso',
        kind: 'secret',
        features: ['sso-saml'],
        summary: "The identity provider's signing certificate, PEM or base64.",
        details:
            'An environment variable cannot hold real newlines: write them as \\n, or point SSO_SAML_IDP_CERT_FILE at the file.'
    },
    {
        name: 'SSO_SAML_ISSUER',
        group: 'sso',
        kind: 'string',
        features: ['sso-saml'],
        summary:
            'The entity id the identity provider registered for this app. Defaults to API_PUBLIC_URL, then PUBLIC_URL.'
    },
    {
        name: 'SSO_SAML_SUBJECT_ATTRIBUTE',
        group: 'sso',
        kind: 'string',
        features: ['sso-saml'],
        summary:
            'The attribute holding a stable id for the person. Set it whenever the NameID is an email address.',
        details:
            'An address follows a mailbox, not a person, and a profile whose subject is one is refused.'
    },
    {
        name: 'SSO_SAML_EMAIL_VERIFIED',
        group: 'sso',
        kind: 'flag',
        default: 'false',
        features: ['sso-saml'],
        summary: 'Treat addresses from the identity provider as verified.',
        details:
            'SAML carries no verification claim at all; setting this asserts your directory owns the addresses it reports.'
    },
    {
        name: 'SSO_PROVISION_DOMAINS',
        group: 'sso',
        kind: 'list',
        features: ['sso'],
        example: 'example.com',
        summary:
            'Email domains an account may be created for on first sign-in. Unset, SSO signs in existing accounts only.'
    },
    {
        name: 'SSO_PROVISION_ROLE',
        group: 'sso',
        kind: 'string',
        default: 'viewer',
        features: ['sso'],
        summary: 'The role a provisioned account starts with.'
    },
    {
        name: 'SSO_ALLOW_PASSWORD_LOGIN',
        group: 'sso',
        kind: 'flag',
        default: 'true',
        features: ['sso'],
        summary:
            'Set false to make single sign-on the only way in. The root administrator keeps a password regardless.'
    },
    // --- copilot ----------------------------------------------------------
    {
        name: 'COPILOT_ENABLED',
        group: 'copilot',
        kind: 'flag',
        default: 'false',
        summary: 'Offer the copilot at all.',
        details:
            'false removes every copilot route and the admin hides the panel. Turning it on with no backend configured refuses to start. It is not what keeps content in-house: no backend is registered without its key.'
    },
    {
        name: 'ANTHROPIC_API_KEY',
        group: 'copilot',
        kind: 'secret',
        features: ['copilot-anthropic'],
        summary: 'The Anthropic API key. Setting it is what registers Claude.'
    },
    {
        name: 'ANTHROPIC_BASE_URL',
        group: 'copilot',
        kind: 'url',
        features: ['copilot-anthropic'],
        summary: 'A gateway or proxy to use instead of api.anthropic.com.'
    },
    {
        name: 'COPILOT_ANTHROPIC_MODELS',
        group: 'copilot',
        kind: 'list',
        default: 'claude-opus-5,claude-sonnet-5,claude-haiku-4-5',
        features: ['copilot-anthropic'],
        summary:
            'The Claude models people may pick, comma-separated. The first is the default.'
    },
    {
        name: 'COPILOT_OPENAI_BASE_URL',
        group: 'copilot',
        kind: 'url',
        features: ['copilot-openai'],
        example: 'http://localhost:11434/v1',
        summary:
            'An OpenAI-compatible endpoint: Ollama, vLLM, LM Studio, LiteLLM, Azure or OpenAI. Setting it registers the backend.'
    },
    {
        name: 'COPILOT_OPENAI_API_KEY',
        group: 'copilot',
        kind: 'secret',
        features: ['copilot-openai'],
        summary: "That endpoint's key. Unset for a local runtime."
    },
    {
        name: 'COPILOT_OPENAI_MODELS',
        group: 'copilot',
        kind: 'list',
        default: 'llama3.1',
        features: ['copilot-openai'],
        summary: 'The models people may pick there. The first is the default.'
    },
    {
        name: 'COPILOT_USER_DAILY_TOKENS',
        group: 'copilot',
        kind: 'int',
        summary:
            'Tokens one person may spend in one workspace per day (UTC). Unset is unlimited.'
    },
    {
        name: 'COPILOT_WORKSPACE_DAILY_TOKENS',
        group: 'copilot',
        kind: 'int',
        summary:
            'Tokens all members of one workspace may spend per day (UTC). Unset is unlimited.'
    },
    {
        name: 'COPILOT_RUNS_PER_MINUTE',
        group: 'copilot',
        kind: 'int',
        summary: 'Runs one person may start per minute. Unset is unlimited.'
    },
    {
        name: 'COPILOT_MAX_CONCURRENT_RUNS',
        group: 'copilot',
        kind: 'int',
        summary:
            'Runs one person may have in flight at once. Unset is unlimited.'
    },
    // --- switches ---------------------------------------------------------
    {
        name: 'API_DOCS',
        group: 'switches',
        kind: 'flag',
        summary:
            'Publish the API reference on /reference and GraphiQL. On outside production unless set.'
    },
    {
        name: 'MCP_ENABLED',
        group: 'switches',
        kind: 'flag',
        default: 'false',
        features: ['mcp'],
        summary: 'Serve the Model Context Protocol endpoint on /api/v1/mcp.',
        details:
            'Once on, any holder of a full-scope API token can edit content from an external agent.'
    },
    {
        name: 'WEBHOOKS_ALLOW_INSECURE_URLS',
        group: 'switches',
        kind: 'flag',
        default: 'false',
        summary:
            'Allow http:// webhook destinations. For local development: the payload is readable on the way.'
    },
    {
        name: 'WEBHOOKS_ALLOW_PRIVATE_NETWORKS',
        group: 'switches',
        kind: 'flag',
        default: 'false',
        summary:
            'Allow webhook destinations on loopback, link-local and private networks.',
        details:
            'Off because a webhook is the server requesting an address a user typed, the shape of every SSRF. Turn it on only when the receiver really is inside this network.'
    },
    // --- development ------------------------------------------------------
    {
        name: 'SCHEMA_BUILDER',
        group: 'development',
        kind: 'flag',
        default: 'false',
        summary:
            'Let the Content model page edit types. It writes code, so it is refused in production whatever this says.'
    },
    {
        name: 'SCHEMA_BUILDER_ROOT',
        group: 'development',
        kind: 'path',
        default: 'apps/server',
        summary:
            "The server app's folder, relative to where the server is started."
    },
    {
        name: 'SCHEMA_BUILDER_RESTART',
        group: 'development',
        kind: 'enum',
        values: ['watch', 'manual'],
        default: 'watch',
        summary:
            'watch waits for the dev watcher to restart the server after an edit; manual asks you to.'
    },
    {
        name: 'ADMIN_PORT',
        group: 'development',
        kind: 'int',
        default: '4200',
        summary: 'The port the admin dev server listens on.'
    },
    {
        name: 'API_PORT',
        group: 'development',
        kind: 'int',
        features: ['workspace'],
        summary:
            'Where the admin dev server proxies /api, when not PORT — an API from another checkout.'
    }
];

/** The catalog entry for `name`. Throws for a name the catalog does not list. */
export function envSpec(name: string): EnvVarSpec {
    const spec = ENV_CATALOG.find((entry) => entry.name === name);
    if (!spec) {
        throw new Error(`${name} is not in the environment catalog.`);
    }
    return spec;
}
