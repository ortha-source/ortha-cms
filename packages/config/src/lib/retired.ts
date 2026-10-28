/**
 * Variables that are no longer read from the environment.
 *
 * Each one used to tune something a deployment almost never changes — a TTL, a
 * GraphQL cost budget, a retry count — and now lives as a literal in the app's
 * own config, next to the plugin it configures. Ignoring a value someone still
 * sets would be the worst way to retire it: `LOGIN_RATE_LIMIT=3` quietly
 * becoming 10, or `GRAPHQL_MAX_DEPTH=4` quietly becoming 8, is a deployment
 * that looks configured and is not. So {@link checkRetiredEnv} warns when a
 * retired variable still holds its old default (it changes nothing; remove the
 * line) and refuses to start when it holds anything else, naming where the
 * value goes now.
 */

/** One retired variable. */
export interface RetiredEnvVar {
    /** The value it defaulted to. Setting exactly this is harmless. */
    readonly default?: string;
    /** Where the setting lives now, as an instruction to the operator. */
    readonly movedTo: string;
}

const IDENTITY = '`plugins.identity` in config/identity.ts';
const OIDC = 'the `oidc` provider in config/identity.ts';
const GITHUB = 'the `github` provider in config/identity.ts';
const SAML = 'the `saml` provider in config/identity.ts';
const COPILOT = '`plugins.copilot` in config/copilot.ts';
const GRAPHQL = '`plugins.contentGraphql` in config/graphql.ts';

/** Every retired variable, with its old default and its new home. */
export const RETIRED_ENV: Readonly<Record<string, RetiredEnvVar>> = {
    MAX_REQUEST_BODY: {
        default: '1mb',
        movedTo: '`bodyLimit` in orthacms.config.ts'
    },
    OUTBOX_RETENTION_DAYS: {
        default: '30',
        movedTo: '`database.outboxRetentionDays` in orthacms.config.ts'
    },
    SESSION_TTL_SECONDS: { default: '604800', movedTo: IDENTITY },
    INVITE_TTL_SECONDS: { default: '604800', movedTo: IDENTITY },
    RESET_TTL_SECONDS: { default: '3600', movedTo: IDENTITY },
    LOGIN_RATE_LIMIT: { default: '10', movedTo: IDENTITY },
    LOGIN_RATE_LIMIT_TTL_SECONDS: { default: '60', movedTo: IDENTITY },
    SSO_REQUEST_TTL_SECONDS: { default: '600', movedTo: IDENTITY },
    SSO_SESSION_TTL_SECONDS: { movedTo: IDENTITY },
    // A provider's name is what every `sso_identities` row refers to it by, so
    // renaming it orphans the links — a decision for a reviewed diff, not for
    // an environment variable someone can change in a dashboard.
    SSO_OIDC_NAME: { default: 'oidc', movedTo: OIDC },
    SSO_OIDC_LABEL: { movedTo: OIDC },
    SSO_OIDC_SCOPES: { default: 'openid,profile,email', movedTo: OIDC },
    SSO_GITHUB_NAME: { default: 'github', movedTo: GITHUB },
    SSO_GITHUB_LABEL: { default: 'GitHub', movedTo: GITHUB },
    SSO_GITHUB_SCOPES: { default: 'read:user,user:email', movedTo: GITHUB },
    SSO_GITHUB_ORG: { movedTo: GITHUB },
    SSO_GITHUB_ORGANIZATION: { movedTo: GITHUB },
    SSO_SAML_NAME: { default: 'saml', movedTo: SAML },
    SSO_SAML_LABEL: { default: 'SAML', movedTo: SAML },
    SSO_SAML_EMAIL_ATTRIBUTE: { movedTo: SAML },
    SSO_SAML_NAME_ATTRIBUTE: { movedTo: SAML },
    SSO_SAML_GROUPS_ATTRIBUTE: { movedTo: SAML },
    MEDIA_MAX_UPLOAD_BYTES: {
        default: '52428800',
        movedTo: '`plugins.media` in config/media.ts'
    },
    MEDIA_DIRECT_SERVE_TTL_SECONDS: {
        default: '300',
        movedTo: '`plugins.media` in config/media.ts'
    },
    COPILOT_MAX_OUTPUT_TOKENS: { default: '8192', movedTo: COPILOT },
    COPILOT_MAX_STEPS: { default: '30', movedTo: COPILOT },
    COPILOT_WALL_CLOCK_MS: { default: '300000', movedTo: COPILOT },
    COPILOT_MAX_TOTAL_TOKENS: { default: '400000', movedTo: COPILOT },
    GRAPHQL_MAX_DEPTH: { default: '8', movedTo: GRAPHQL },
    GRAPHQL_MAX_COMPLEXITY: { default: '1000', movedTo: GRAPHQL },
    GRAPHQL_MAX_FIELDS: { default: '500', movedTo: GRAPHQL },
    GRAPHQL_MAX_QUERY_LENGTH: { default: '16384', movedTo: GRAPHQL },
    GRAPHQL_SCHEMA_CACHE_TTL_MS: { default: '60000', movedTo: GRAPHQL },
    MCP_CALL_TIMEOUT_MS: {
        default: '30000',
        movedTo: '`plugins.mcp` in config/mcp.ts'
    },
    MCP_MAX_RESULT_BYTES: {
        default: '4194304',
        movedTo: '`plugins.mcp` in config/mcp.ts'
    },
    SEGMENTS_READER_TAGS_HEADER: {
        default: 'x-reader-tags',
        movedTo: 'the resolver in config/segments.ts'
    },
    WEBHOOKS_DELIVERY_INTERVAL: {
        default: '2000',
        movedTo:
            'ORTHACMS_WORKERS=false (to stop sending from this process), or `plugins.webhooks` in config/webhooks.ts'
    },
    WEBHOOKS_TIMEOUT: {
        default: '10000',
        movedTo: '`plugins.webhooks` in config/webhooks.ts'
    },
    WEBHOOKS_RETENTION_DAYS: {
        default: '30',
        movedTo: '`plugins.webhooks` in config/webhooks.ts'
    },
    MAIL_DELIVERY_INTERVAL_MS: {
        default: '2000',
        movedTo:
            'ORTHACMS_WORKERS=false (to stop sending from this process), or `plugins.mail` in config/mail.ts'
    },
    MAIL_MAX_ATTEMPTS: {
        default: '5',
        movedTo: '`plugins.mail` in config/mail.ts'
    },
    SMTP_CONNECTION_TIMEOUT_MS: { movedTo: '`plugins.mail` in config/mail.ts' }
};

/**
 * Warns about retired variables set to their old default, and throws for any
 * set to something else.
 *
 * Call it once, before the config is built: it reads `process.env` directly
 * because the variables it looks for are, by definition, ones the readers no
 * longer know.
 */
export function checkRetiredEnv(
    env: NodeJS.ProcessEnv = process.env,
    warn: (message: string) => void = (message) => console.warn(message)
): void {
    const refused: string[] = [];
    for (const [name, retired] of Object.entries(RETIRED_ENV)) {
        const value = env[name]?.trim();
        if (!value) {
            continue;
        }
        if (retired.default !== undefined && value === retired.default) {
            warn(
                `${name} is no longer read from the environment, and the value set is its default — remove the line.`
            );
            continue;
        }
        refused.push(`- ${name}=${value}: set it in ${retired.movedTo}.`);
    }
    if (refused.length > 0) {
        throw new Error(
            'These variables are no longer read from the environment, and ignoring the values set would change this deployment without a word:\n' +
                refused.join('\n')
        );
    }
}
