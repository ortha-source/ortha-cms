/**
 * Typed application configuration for the Ortha CMS server.
 *
 * This is the single place that reads `process.env`. Everything
 * downstream (`createServer`, plugins) receives typed config — nothing
 * else should reach for environment variables directly. Deploy-specific
 * values come from the environment; stable tuning lives here as literals.
 */

import type {
    ApiDocsOptions,
    TrustProxySetting
} from '@orthacms/bootstrap-server';
import type { CopilotPluginConfig } from '@orthacms/copilot-server';
import type { AnthropicProviderConfig } from '@orthacms/copilot-provider-anthropic';
import type { OpenAiProviderConfig } from '@orthacms/copilot-provider-openai';
import type { ContentGraphqlPluginConfig } from '@orthacms/content-graphql';
import type { IdentityPluginConfig } from '@orthacms/identity-server';
import type { OidcProviderConfig } from '@orthacms/identity-provider-oidc';
import type { GithubProviderConfig } from '@orthacms/identity-provider-github';
import type { SamlProviderConfig } from '@orthacms/identity-provider-saml';
import type { I18nPluginConfig } from '@orthacms/i18n-server';
import type { McpPluginConfig } from '@orthacms/mcp-server';
import type { TransferPluginConfig } from '@orthacms/transfer-server';
import type { SegmentsPluginConfig } from '@orthacms/segments-server';
import type { MediaPluginConfig } from '@orthacms/media-server';
import type { LocalStorageConfig } from '@orthacms/media-provider-local';

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
 *
 * **A key is present only when the deployment configured that backend**, and
 * `plugins.ts` registers exactly the ones that are. There is no
 * `defaultProvider` naming one of them: the registered list *is* the setting,
 * its first entry serves a run that names none, and the admin's picker opens on
 * it. A name in a variable could be misspelled, could point at a backend nobody
 * registered, and had to be kept in step with the list on every change — while
 * "configured" is a fact this file can read directly.
 */
export interface OrthaCopilotConfig extends CopilotPluginConfig {
    /**
     * Model backends, keyed by the name they are registered under, in
     * preference order. Each is absent unless its connection settings are
     * present — a keyless clone gets neither, and therefore no copilot at all.
     * There is no scripted fallback: `plugins.ts` registers exactly what is
     * configured here, so `COPILOT_ENABLED=true` with nothing configured fails
     * at boot rather than answering every question with a canned sentence.
     */
    providers: {
        /** Native Claude. Present when `ANTHROPIC_API_KEY` is set. */
        claude?: AnthropicProviderConfig;
        /**
         * An OpenAI-wire-format endpoint — a local Ollama, vLLM, LiteLLM,
         * Azure or OpenAI itself. Present when `COPILOT_OPENAI_BASE_URL` is
         * set: an endpoint nobody named is a backend that can only time out,
         * and offering it in the picker would be worse than not having it.
         */
        ollama?: OpenAiProviderConfig;
    };
}

/**
 * Identity settings, plus the connection settings for the identity providers
 * this deployment can reach.
 *
 * The provider settings live **here**, not inside `IdentityPluginConfig`: the
 * plugin is adapter-agnostic by decision (ADR-0013 §1), so it names no
 * protocol. `plugins.ts` already imports the adapter factories, so importing
 * their config type costs no new coupling — and adding a second identity
 * provider is a key here plus a line there, with nothing to change inside the
 * identity packages.
 *
 * A key is present only when the deployment configured that provider, exactly
 * as the copilot's backends are. A half-configured provider is worse than an
 * absent one: it appears on the sign-in page as a button that can only fail,
 * and every SSO failure deliberately looks the same, so the person clicking it
 * learns nothing.
 */
export interface OrthaIdentityConfig extends IdentityPluginConfig {
    /**
     * Identity providers, keyed by the name they are registered under. That
     * name appears in the sign-in URL and in every `sso_identities` row, so
     * changing it orphans the links that name it.
     */
    ssoProviders: {
        /**
         * A generic OpenID Connect provider — Okta, Auth0, Keycloak, Google,
         * Entra ID, Authentik, Zitadel and the rest all speak it. Present when
         * `SSO_OIDC_ISSUER` and `SSO_OIDC_CLIENT_ID` are both set.
         *
         * Registered under the name in `SSO_OIDC_NAME` (default `oidc`). To run
         * two at once — a staff directory and a contractor one — copy this key
         * and the matching line in `plugins.ts`; the adapter takes its whole
         * configuration as an argument, so nothing else changes.
         */
        oidc?: OidcProviderConfig & { name: string };
        /**
         * GitHub or GitHub Enterprise Server. Its own key because GitHub is
         * OAuth2, not OIDC — there is no identity token, so it is a different
         * adapter rather than a preset. Present when both credentials are set.
         */
        github?: GithubProviderConfig & { name: string };
        /**
         * A SAML 2.0 identity provider. Present when the entry point and the
         * signing certificate are both set — SAML has no discovery document, so
         * the certificate is the whole of the trust relationship and there is
         * nothing to fall back to.
         */
        saml?: SamlProviderConfig & { name: string };
    };
}

/**
 * Media settings, plus the connection settings for the one storage backend this
 * deployment runs.
 *
 * The backend settings live **here**, not in `MediaPluginConfig`, for the same
 * reason the copilot's provider settings do (ADR-0004 §2): the plugin names no
 * backend. `plugins.ts` already imports the adapter factory, so importing its
 * config type costs no new coupling — and switching storage is that import plus
 * the type named below, with nothing to change inside the media packages.
 */
export interface OrthaMediaConfig extends MediaPluginConfig {
    /**
     * Whatever the constructed provider needs. Typed by the factory
     * `plugins.ts` calls — `LocalStorageConfig` today; swapping to
     * `createS3StorageProvider` swaps this type with it.
     */
    storage: LocalStorageConfig;
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
    /**
     * How many reverse proxies sit in front of the app, sourced from
     * `TRUST_PROXY`. Undefined when unset, which is what a directly-exposed
     * deployment wants; behind a load balancer it must be set or every client
     * shares one rate-limit bucket.
     */
    trustProxy?: TrustProxySetting;
    /**
     * Cap on a JSON / urlencoded request body, sourced from
     * `MAX_REQUEST_BODY`. Defaults to 1 MB — see the note on the literal below.
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
    };
}

/**
 * Reads a deploy value the server cannot run without, failing at load rather
 * than several seconds into boot.
 *
 * Left to default to `''`, a missing `DATABASE_URL` reaches `pg` as "use the
 * libpq defaults", and the first thing that touches the database — identity's
 * role seeder, during `onApplicationBootstrap` — fails with whatever the local
 * libpq environment happens to produce (measured: `SASL:
 * SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`). The server
 * does fail closed, which is the important half, but nothing in that message
 * names the variable that was never set.
 */
function requireEnv(name: string): string {
    const raw = process.env[name]?.trim();
    if (!raw) {
        throw new Error(
            `Missing required environment variable ${name}. ` +
                'Copy `.env.example` to `.env` and set it (see `README.md`); ' +
                'the server has no usable default for this value.'
        );
    }
    return raw;
}

/**
 * Reads a numeric setting: the default when unset or empty, the value when it is
 * a plain positive decimal integer, and an error otherwise.
 *
 * This replaces `Number(process.env[x]) || default`, which was wrong in three
 * directions at once and silent in all of them. `0` is falsy, so it became the
 * default — `LOGIN_RATE_LIMIT=0` ("block every login") quietly meant 10. A
 * negative is truthy, so it was accepted — `SESSION_TTL_SECONDS=-1` issued every
 * session already expired, login answering `201` and the very next request
 * `401`. And exponent notation parsed, so `GRAPHQL_MAX_DEPTH=1e9` removed the
 * cost budget that ADR-0008 calls GraphQL's replacement for REST's structural
 * bound. Refusing to boot names the variable; the alternative was a deployment
 * that looked configured and was not.
 *
 * Empty is deliberately *not* an error: `.env.example` ships several keys with
 * no value, and a fresh clone must boot from it unchanged.
 */
function readPositiveInt(name: string, fallback: number): number {
    const value = readOptionalPositiveInt(name);
    return value ?? fallback;
}

/** As {@link readPositiveInt}, but `undefined` when unset — no default to fall back to. */
function readOptionalPositiveInt(name: string): number | undefined {
    const raw = process.env[name]?.trim();
    if (!raw) {
        return undefined;
    }
    // Plain decimal digits only. `Number` would also take `1e9`, `0x20` and
    // `Infinity`, none of which anyone means to write in a `.env`.
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
 * The copilot backends this deployment can actually reach.
 *
 * Read out here because they gate whether a provider is registered at all
 * (see `OrthaCopilotConfig.providers`), and a conditional spread reads better
 * against a named value than against a nested `process.env` lookup.
 */
/**
 * The identity provider this deployment can reach, if any.
 *
 * Both values are read out here because both gate whether the provider is
 * configured at all: an issuer with no client id (or the reverse) becomes a
 * button on the sign-in page that can only fail.
 */
const ssoOidcIssuer = process.env['SSO_OIDC_ISSUER']?.trim();
const ssoOidcClientId = process.env['SSO_OIDC_CLIENT_ID']?.trim();
const ssoGithubClientId = process.env['SSO_GITHUB_CLIENT_ID']?.trim();
const ssoGithubClientSecret = process.env['SSO_GITHUB_CLIENT_SECRET']?.trim();
const ssoSamlEntryPoint = process.env['SSO_SAML_ENTRY_POINT']?.trim();
const ssoSamlCert = process.env['SSO_SAML_IDP_CERT']?.trim();

const anthropicApiKey = process.env['ANTHROPIC_API_KEY']?.trim();
const openAiBaseUrl = process.env['COPILOT_OPENAI_BASE_URL']?.trim();

/** The deployment modes this app recognises. */
const NODE_ENVS = ['development', 'test', 'production'] as const;

/**
 * Reads `NODE_ENV`, rejecting a value that is neither recognised nor empty.
 *
 * `NODE_ENV !== 'production'` is the switch behind **two** protections at once —
 * whether the API reference and GraphiQL are published, and whether the session
 * cookie carries `Secure` — so any value that is not exactly `production` turns
 * both off. Unset is a legitimate, and the common, local state; a *typo* is not,
 * and it is indistinguishable from correct configuration until you read a
 * `Set-Cookie` header. Measured on this app: `NODE_ENV=produciton` serves
 * `/reference/json` to an unauthenticated caller and drops `Secure` from the
 * session cookie, exactly as if nothing had been set (ORT-137).
 *
 * Rejecting the typo costs a deployment that spells it right nothing, and turns
 * a silent downgrade into a refusal to start.
 */
function readNodeEnv(): (typeof NODE_ENVS)[number] | undefined {
    const raw = process.env['NODE_ENV']?.trim();
    if (!raw) {
        return undefined;
    }
    if (!(NODE_ENVS as readonly string[]).includes(raw)) {
        throw new Error(
            `NODE_ENV is "${raw}", which this app does not recognise — expected ` +
                `one of ${NODE_ENVS.join(', ')}, or nothing at all for local ` +
                'development. Anything else reads as "not production", which ' +
                'publishes the API reference and drops `Secure` from the session ' +
                'cookie.'
        );
    }
    return raw as (typeof NODE_ENVS)[number];
}

/** True only in a deployment that said so, with the spelling checked. */
const isProduction = readNodeEnv() === 'production';

/**
 * Reads `TRUST_PROXY` into Express's `trust proxy` setting.
 *
 * Three accepted shapes, in the order they are checked: a hop count (`'1'` —
 * the recommended form, and the only one a client cannot forge past), a
 * boolean (`'true'` trusts the entire `X-Forwarded-For` chain, `'false'`
 * trusts none), or any other non-empty string, passed to Express verbatim as a
 * subnet/preset list (`'loopback'`, `'10.0.0.0/8'`). Unset yields `undefined`,
 * leaving Express's default of ignoring forwarded headers entirely.
 */
function readTrustProxy(): TrustProxySetting | undefined {
    const raw = process.env['TRUST_PROXY']?.trim();
    if (!raw) {
        return undefined;
    }
    const hops = Number(raw);
    if (Number.isInteger(hops) && hops >= 0) {
        return hops;
    }
    if (raw === 'true' || raw === 'false') {
        return raw === 'true';
    }
    return raw;
}

/**
 * The admin dev origin this checkout's stack serves from — `ADMIN_PORT` is the
 * per-worktree Vite port (`docs/parallel-stacks.md`), 4200 when unset.
 */
function defaultAdminOrigin(): string {
    return `http://localhost:${readPositiveInt('ADMIN_PORT', 4200)}`;
}

/**
 * The copilot's run ceilings, each `undefined` to leave the plugin's own
 * default in place.
 *
 * Read out here because the keys are *conditionally spread* below: a
 * `DEFAULT_RUN_LIMITS` entry has to survive an unset variable, and spreading
 * `{ maxSteps: undefined }` would overwrite it with nothing. Zero is rejected
 * rather than silently ignored — `maxSteps: 0` skips the run loop entirely,
 * yielding a thread that shows a question and then silence, which is why
 * `CopilotPlugin` refuses it at construction too.
 *
 * All three are exposed, not just `maxSteps`. They are checked in the same
 * loop, so an operator who raises one alone moves the wall rather than lifting
 * it: a run given more steps but the same wall clock stops on `timeout`
 * instead, which reads to the user as the same truncated answer.
 */
const maxSteps = readOptionalPositiveInt('COPILOT_MAX_STEPS');
const wallClockMs = readOptionalPositiveInt('COPILOT_WALL_CLOCK_MS');
const maxTotalTokens = readOptionalPositiveInt('COPILOT_MAX_TOTAL_TOKENS');
const runLimits = {
    ...(maxSteps !== undefined ? { maxSteps } : {}),
    ...(wallClockMs !== undefined ? { wallClockMs } : {}),
    ...(maxTotalTokens !== undefined ? { maxTotalTokens } : {})
};

const config: OrthaConfig = {
    port: readPositiveInt('PORT', 3000),
    globalPrefix: 'api',
    // Unset by default: a directly-exposed server must not believe a
    // client-supplied `X-Forwarded-For`. Deployments behind a load balancer set
    // `TRUST_PROXY` to their hop count.
    trustProxy: readTrustProxy(),
    // The largest JSON body a route will accept. Stable tuning, hence a
    // literal, with an env override for a deployment whose entries are larger.
    // 1 MB rather than express's inherited 100 kB default: that ceiling sat
    // below a long-form article with embedded rich text, and it was refused
    // with a bare `413` from the parser — before any controller, guard or
    // protocol layer could shape the answer. Uploads are unrelated and much
    // larger; they are multipart, capped by `plugins.media.maxUploadBytes`.
    bodyLimit: process.env['MAX_REQUEST_BODY'] || '1mb',
    database: {
        url: requireEnv('DATABASE_URL')
    },
    docs: {
        // On outside production, where the reference is a development tool.
        // `API_DOCS` overrides either way — set it to `true` to publish the
        // reference from a deployed instance.
        enabled: process.env['API_DOCS']
            ? process.env['API_DOCS'] === 'true'
            : !isProduction,
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
            // Origins allowed to call state-changing endpoints (login-CSRF
            // defense). Comma-separated; defaults to the dev admin origin —
            // which follows `ADMIN_PORT`, so a parallel worktree stack on
            // :4201 is not rejected by a default pinned to :4200.
            allowedOrigins: (
                process.env['ALLOWED_ORIGINS'] ?? defaultAdminOrigin()
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
            // Login rate limit. Defaults preserve the historical 10 req / 60s.
            rateLimit: {
                ttlSeconds: readPositiveInt('LOGIN_RATE_LIMIT_TTL_SECONDS', 60),
                limit: readPositiveInt('LOGIN_RATE_LIMIT', 10)
            },
            rootAdmin: {
                email: process.env['ORTHA_ROOT_ADMIN_EMAIL'] ?? '',
                password: process.env['ORTHA_ROOT_ADMIN_PASSWORD'] ?? '',
                name: process.env['ORTHA_ROOT_ADMIN_NAME'] ?? ''
            },
            // Single sign-on. The *providers* are not here — they are
            // constructed adapters and are registered in `plugins.ts`, the same
            // split the copilot makes between connection settings and built
            // backends. What lives here is the deployment shape of the
            // handshake.
            sso: {
                // The origin browsers reach this API on. It builds the
                // `redirect_uri` registered with each identity provider, and it
                // is configured rather than read from the request's `Host`
                // header — which a client controls, and could therefore point
                // at an origin of its choosing. Unset, it falls back to the
                // first `allowedOrigins` entry, which is right whenever the
                // admin and the API share an origin: the deployed shape, and
                // the dev one where Vite proxies `/api`.
                ...(process.env['SSO_PUBLIC_BASE_URL']
                    ? { publicBaseUrl: process.env['SSO_PUBLIC_BASE_URL'] }
                    : {}),
                // How long one sign-in attempt stays live. Ten minutes by
                // default: a consent screen plus a second factor, and no
                // longer — an attempt left open in a forgotten tab should not
                // be a credential sitting around for the afternoon.
                requestTtlSeconds: readPositiveInt(
                    'SSO_REQUEST_TTL_SECONDS',
                    600
                ),
                // Just-in-time provisioning, off unless a domain list is set.
                // The list is what makes this safe: an identity provider
                // answers for everyone it knows, and a public one knows
                // everyone, so provisioning without one means anybody with an
                // account there can sign in here — and nothing breaks to say
                // so, the user list simply grows.
                ...(process.env['SSO_PROVISION_DOMAINS']
                    ? {
                          provisioning: {
                              domains: readList('SSO_PROVISION_DOMAINS', ''),
                              defaultRole:
                                  process.env['SSO_PROVISION_ROLE'] ?? 'viewer'
                          }
                      }
                    : {}),
                // Passwords stay on unless a deployment turns them off. The
                // root administrator keeps one regardless — see the note on
                // `IdentitySsoConfig.allowPasswordLogin`; without that
                // exemption a mis-scoped provider locks an operator out of
                // their own CMS with no way back short of a database client.
                allowPasswordLogin:
                    process.env['SSO_ALLOW_PASSWORD_LOGIN'] !== 'false',
                // Shorter than the ordinary session lifetime for a provider
                // with no back-channel logout: without one, a session's own
                // expiry is the only thing that eventually ends access after
                // somebody is offboarded.
                ...(process.env['SSO_SESSION_TTL_SECONDS']
                    ? {
                          sessionTtlSeconds: readPositiveInt(
                              'SSO_SESSION_TTL_SECONDS',
                              600
                          )
                      }
                    : {})
            },
            ssoProviders: {
                ...(ssoOidcIssuer && ssoOidcClientId
                    ? {
                          oidc: {
                              // What the route and every link row call this
                              // provider. Stable by necessity: renaming it
                              // orphans the links that name it.
                              name: process.env['SSO_OIDC_NAME'] ?? 'oidc',
                              issuer: ssoOidcIssuer,
                              clientId: ssoOidcClientId,
                              ...(process.env['SSO_OIDC_CLIENT_SECRET']
                                  ? {
                                        clientSecret:
                                            process.env[
                                                'SSO_OIDC_CLIENT_SECRET'
                                            ]
                                    }
                                  : {}),
                              ...(process.env['SSO_OIDC_LABEL']
                                  ? { label: process.env['SSO_OIDC_LABEL'] }
                                  : {}),
                              ...(process.env['SSO_OIDC_SCOPES']
                                  ? {
                                        scopes: readList(
                                            'SSO_OIDC_SCOPES',
                                            'openid,profile,email'
                                        )
                                    }
                                  : {}),
                              // Only when an operator says so. The claim is the
                              // sole gate on a first sign-in claiming an
                              // existing account, so a provider that omits it
                              // — Entra ID, notably — links nobody until
                              // someone asserts that this directory owns the
                              // addresses it reports.
                              emailVerifiedWhenAbsent:
                                  process.env[
                                      'SSO_OIDC_EMAIL_VERIFIED_WHEN_ABSENT'
                                  ] === 'true'
                          }
                      }
                    : {}),
                ...(ssoGithubClientId && ssoGithubClientSecret
                    ? {
                          github: {
                              name: process.env['SSO_GITHUB_NAME'] ?? 'github',
                              clientId: ssoGithubClientId,
                              clientSecret: ssoGithubClientSecret,
                              ...(process.env['SSO_GITHUB_LABEL']
                                  ? { label: process.env['SSO_GITHUB_LABEL'] }
                                  : {}),
                              ...(process.env['SSO_GITHUB_ENTERPRISE_URL']
                                  ? {
                                        enterpriseBaseUrl:
                                            process.env[
                                                'SSO_GITHUB_ENTERPRISE_URL'
                                            ]
                                    }
                                  : {}),
                              ...(process.env['SSO_GITHUB_ORG']
                                  ? {
                                        organization:
                                            process.env['SSO_GITHUB_ORG']
                                    }
                                  : {})
                          }
                      }
                    : {}),
                ...(ssoSamlEntryPoint && ssoSamlCert
                    ? {
                          saml: {
                              name: process.env['SSO_SAML_NAME'] ?? 'saml',
                              entryPoint: ssoSamlEntryPoint,
                              idpCert: ssoSamlCert,
                              // The entity id the identity provider has
                              // registered for this application. Defaults to
                              // the CMS's own origin, which is what most
                              // administrators enter when nobody tells them
                              // otherwise.
                              issuer:
                                  process.env['SSO_SAML_ISSUER'] ??
                                  process.env['SSO_PUBLIC_BASE_URL'] ??
                                  '',
                              ...(process.env['SSO_SAML_LABEL']
                                  ? { label: process.env['SSO_SAML_LABEL'] }
                                  : {}),
                              ...(process.env['SSO_SAML_SUBJECT_ATTRIBUTE']
                                  ? {
                                        subjectAttribute:
                                            process.env[
                                                'SSO_SAML_SUBJECT_ATTRIBUTE'
                                            ]
                                    }
                                  : {}),
                              ...(process.env['SSO_SAML_EMAIL_ATTRIBUTE']
                                  ? {
                                        emailAttribute:
                                            process.env[
                                                'SSO_SAML_EMAIL_ATTRIBUTE'
                                            ]
                                    }
                                  : {}),
                              ...(process.env['SSO_SAML_GROUPS_ATTRIBUTE']
                                  ? {
                                        groupsAttribute:
                                            process.env[
                                                'SSO_SAML_GROUPS_ATTRIBUTE'
                                            ]
                                    }
                                  : {}),
                              // SAML carries no verification claim at all, so
                              // this is always an operator's assertion that
                              // their directory owns the addresses it reports.
                              emailVerified:
                                  process.env['SSO_SAML_EMAIL_VERIFIED'] ===
                                  'true'
                          }
                      }
                    : {})
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
            ],
            // What to do at boot when entry rows exist in a locale no longer
            // listed above. Removing a locale does not remove its rows, and
            // from that moment they are invisible to every read path — intact
            // and unreachable, which is the worst shape for a silent failure.
            // Failing the boot puts the choice (migrate the rows, or restore
            // the locale) in front of whoever edited this array. `warn` for a
            // deployment knowingly mid-migration.
            orphanedLocales: 'fail'
        },
        transfer: {
            // Which field identifies a record of each type, per content type.
            //
            // This is the setting that decides whether importing the same file
            // twice updates the records or duplicates them. Left out, a type
            // falls back to a derived guess — a field *named* like an
            // identifier (`slug`, `sku`, `email`), then the first required text
            // field — which is usually right and is reported in every export's
            // manifest, but is still a guess. Name the fields for any type
            // where being wrong would be expensive:
            //
            //   identity: { product: ['sku'], author: ['email'] }
            //
            // The shipped template registers no content types, so there is
            // nothing to key here yet.
            identity: {},
            // Ceilings on one transfer. The defaults (see
            // `DEFAULT_TRANSFER_LIMITS`) sit comfortably above real editorial
            // work and far below "the whole library"; the import-side archive
            // limits are a safety boundary rather than a capacity setting, so
            // lowering them costs nothing and raising them should be
            // deliberate.
            limits: {}
        },
        segments: {
            // Where a reader's tags come from — the one line this feature needs
            // per install. A resolver receives the request, so a JWT claim, a
            // header the CDN sets, or a lookup against a billing system are all
            // equally reachable:
            //
            //   resolver: {
            //       resolve: async (request) => readTagsFrom(request)
            //   }
            //
            // Left out — as it is here — every reader is anonymous, so
            // unrestricted content serves and restricted content does not.
            // That is a working configuration, and it fails in the safe
            // direction: an audience nobody can be resolved into cannot
            // accidentally be admitted.
        },
        media: {
            // Settings for the storage backend `plugins.ts` constructs. There
            // is no variable naming which backend runs: that is decided by the
            // factory the composition root imports, so a value here can never
            // point at an adapter nobody wired.
            storage: {
                // Blobs live under a git-ignored project dir by default; point
                // MEDIA_LOCAL_ROOT at a persistent volume for real deployments.
                rootDir: process.env['MEDIA_LOCAL_ROOT'] ?? './.storage/media'
            },
            // Off unless asked for, and only meaningful on a backend that can
            // sign a URL — the plugin refuses the combination at boot rather
            // than proxying while the operator believes otherwise. The default
            // local-filesystem provider cannot, so setting this here without
            // switching the provider in `plugins.ts` is a boot error naming
            // both, which is the intended way to find out.
            directServe:
                process.env['MEDIA_DIRECT_SERVE'] === 'signed-url'
                    ? 'signed-url'
                    : 'off',
            directServeTtlSeconds: readPositiveInt(
                'MEDIA_DIRECT_SERVE_TTL_SECONDS',
                300
            ),
            // Upload cap — 50 MB by default.
            maxUploadBytes: readPositiveInt(
                'MEDIA_MAX_UPLOAD_BYTES',
                52_428_800
            )
        },
        contentGraphql: {
            // The cost budget one GraphQL operation may spend. REST bounded a
            // request structurally — one route, one page — and a GraphQL
            // document does not, so these are the replacement bound. Stable
            // tuning, hence literals, with env overrides for an operator who
            // needs to loosen or tighten them without a redeploy.
            limits: {
                maxDepth: readPositiveInt('GRAPHQL_MAX_DEPTH', 8),
                maxComplexity: readPositiveInt('GRAPHQL_MAX_COMPLEXITY', 1000),
                maxFields: readPositiveInt('GRAPHQL_MAX_FIELDS', 500),
                maxQueryLength: readPositiveInt(
                    'GRAPHQL_MAX_QUERY_LENGTH',
                    16_384
                )
            },
            // How long a built schema is reused before it is derived again from
            // the workspace's content grants. Freshness only — every read is
            // authorized against the live grants regardless.
            schemaCacheTtlMs: readPositiveInt(
                'GRAPHQL_SCHEMA_CACHE_TTL_MS',
                60_000
            )
        },
        copilot: {
            // Off by default (ADR-0005 §10). Enabling a hosted provider sends
            // workspace content to a third party, so an operator opts in.
            enabled: process.env['COPILOT_ENABLED'] === 'true',
            maxOutputTokens: readPositiveInt(
                'COPILOT_MAX_OUTPUT_TOKENS',
                8_192
            ),
            // Run ceilings, each keeping `DEFAULT_RUN_LIMITS` when unset. The
            // whole object is spread away when nothing is set, so an untouched
            // `.env` leaves the plugin's defaults visible rather than pinning
            // them here. Raising these costs tokens rather than safety — every
            // step is still authorized and audited, and a `propose` tool still
            // writes its row before it writes anything else.
            ...(Object.keys(runLimits).length > 0 ? { limits: runLimits } : {}),
            // Each backend is here only if it was configured. Registering
            // one that cannot answer used to be harmless because
            // `COPILOT_PROVIDER` decided who served a run; now the first
            // registered provider does, so a keyless `claude` sitting at the
            // top of the list would be the default and would fail on the first
            // message. Absent instead, it is not in the catalogue, not in the
            // picker, and not a default anybody has to override.
            providers: {
                ...(anthropicApiKey
                    ? {
                          claude: {
                              apiKey: anthropicApiKey,
                              // Stable product configuration, so literals like
                              // the i18n locales. First is the default; the
                              // rest are what a user can switch to
                              // mid-conversation. Comma-separated env override
                              // for pinning a different set without a redeploy.
                              models: readList(
                                  'COPILOT_ANTHROPIC_MODELS',
                                  'claude-opus-5,claude-sonnet-5,claude-haiku-4-5'
                              ),
                              ...(process.env['ANTHROPIC_BASE_URL']
                                  ? {
                                        baseUrl:
                                            process.env['ANTHROPIC_BASE_URL']
                                    }
                                  : {})
                          }
                      }
                    : {}),
                ...(openAiBaseUrl
                    ? {
                          ollama: {
                              // A local Ollama is http://localhost:11434/v1 —
                              // point it at vLLM, LiteLLM, Azure or OpenAI
                              // instead. No default: an unset variable means
                              // "this deployment has no such backend", not
                              // "assume one is running on this laptop".
                              baseUrl: openAiBaseUrl,
                              models: readList(
                                  'COPILOT_OPENAI_MODELS',
                                  'llama3.1'
                              ),
                              apiKey:
                                  process.env['COPILOT_OPENAI_API_KEY'] ?? ''
                          }
                      }
                    : {})
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
            version: '1.0.0',
            // A request/response transport owes its caller an answer. The
            // registry has no deadline of its own, so without this the only
            // bound on a `tools/call` is the query underneath it — and a
            // blocked pool turns one call into a socket held until the client
            // gives up. 30s is generous for every shipped tool and far short of
            // the load balancer idle timeouts these deployments sit behind.
            callTimeoutMs: readPositiveInt('MCP_CALL_TIMEOUT_MS', 30_000),
            // Deliberately generous: nothing in the catalogue returns this much
            // today, so the ceiling exists to keep a pathological result from
            // being serialised three times over rather than to shape normal
            // use. A result this large does not fit a model's context either.
            maxResultBytes: readPositiveInt('MCP_MAX_RESULT_BYTES', 4_194_304)
        }
    }
};

export default config;
