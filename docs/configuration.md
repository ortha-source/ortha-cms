# Configuration reference

<!-- Generated from packages/config/src/lib/catalog.ts by `ORTHACMS_WRITE_GENERATED=1 npx nx test config`. Edit the catalog, not this file. -->

Every environment variable an Ortha CMS server reads. Settings that almost
no deployment changes — TTLs, rate limits, GraphQL cost budgets, retry counts —
are not environment variables: they are literals in the app’s own
`apps/server/config/`, next to the plugin they configure.

- **Empty means unset.** `KEY=` is the same as no line at all.
- **Any variable can come from a file**: set `NAME_FILE=/run/secrets/name` and
  leave `NAME` unset. That is how Docker and Kubernetes secrets reach the app.
- **Values are checked at boot.** A number that is not a plain positive integer,
  a flag that is not `true`/`false`/`1`/`0`, a value outside a list, a URL
  without a scheme — each refuses to start, naming the variable.
- **`orthacms setup`** writes these for you and checks each one;
  **`orthacms doctor`** shows what is in effect and where it came from.

## Server

| Variable           | Default | Required      | What it is                                                                                            |
| ------------------ | ------- | ------------- | ----------------------------------------------------------------------------------------------------- |
| `NODE_ENV`         |         | in production | The deployment mode. One of `development`, `test`, `production`.                                      |
| `PORT`             | `3000`  |               | The port the server listens on.                                                                       |
| `PUBLIC_URL`       |         | in production | The address people open the admin on.                                                                 |
| `EXTRA_ORIGINS`    |         |               | More origins allowed to sign in, comma-separated, when the admin is also served from another address. |
| `API_PUBLIC_URL`   |         |               | The address browsers reach the API on, when it is not PUBLIC_URL.                                     |
| `TRUST_PROXY`      |         |               | How many reverse proxies sit in front of the server. Required behind a load balancer, ingress or CDN. |
| `ORTHACMS_WORKERS` | `true`  |               | Whether this process sends webhooks and mail.                                                         |

- **`NODE_ENV`** — Spelled exactly. Anything but production publishes the API reference and drops Secure from the session cookie, so a typo refuses to start rather than reading as "not production". Unset is the ordinary local state.
- **`PUBLIC_URL`** — The allowed origin for sign-in, the SSO callback URLs and every link in an email are built from it. Outside production it defaults to http://localhost:<ADMIN_PORT>; in production the server refuses to start without it.
- **`API_PUBLIC_URL`** — Only for an API on its own origin. SSO callback URLs are built from it, and from PUBLIC_URL when it is unset.
- **`TRUST_PROXY`** — Required behind a load balancer, ingress or CDN: unset, every request reports the proxy address and the login rate limit becomes one bucket for everyone. Prefer the hop count; true or a subnet list are passed to Express as they are. Leave unset when the server is exposed directly.
- **`ORTHACMS_WORKERS`** — Set false on web nodes when a separate process does the sending: deliveries still queue, and the worker picks them up. Some process must run with it on.

## Database

| Variable       | Default | Required | What it is                        |
| -------------- | ------- | -------- | --------------------------------- |
| `DATABASE_URL` |         | always   | The PostgreSQL connection string. |

## First administrator

| Variable                       | Default | Required | What it is                                                            |
| ------------------------------ | ------- | -------- | --------------------------------------------------------------------- |
| `ORTHACMS_ROOT_ADMIN_EMAIL`    |         |          | An administrator to create on boot, when no account has this address. |
| `ORTHACMS_ROOT_ADMIN_PASSWORD` |         |          | That administrator's password. Hashed before it is stored.            |
| `ORTHACMS_ROOT_ADMIN_NAME`     |         |          | That administrator's display name.                                    |

- **`ORTHACMS_ROOT_ADMIN_EMAIL`** — Idempotent and non-destructive: an existing account is left alone. `orthacms setup` creates the first admin without it; use it where nothing interactive runs.

## Uploads

| Variable                        | Default            | Required       | What it is                                                                                                                                     |
| ------------------------------- | ------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `MEDIA_LOCAL_ROOT`              | `./.storage/media` |                | The directory uploads are written to.                                                                                                          |
| `MEDIA_S3_BUCKET`               |                    | when installed | The S3 bucket uploads land in.                                                                                                                 |
| `MEDIA_S3_ENDPOINT`             |                    |                | The endpoint, for anything but AWS S3 itself: R2, MinIO, Spaces, B2, Wasabi.                                                                   |
| `MEDIA_S3_REGION`               | `auto`             |                | The region. AWS needs its real one; R2 takes auto.                                                                                             |
| `MEDIA_S3_FORCE_PATH_STYLE`     | `false`            |                | Path-style bucket addressing. MinIO needs it.                                                                                                  |
| `MEDIA_S3_ACCESS_KEY_ID`        |                    |                | The access key.                                                                                                                                |
| `MEDIA_S3_SECRET_ACCESS_KEY`    |                    |                | The secret key.                                                                                                                                |
| `MEDIA_GCS_BUCKET`              |                    | when installed | The Cloud Storage bucket uploads land in.                                                                                                      |
| `MEDIA_GCS_PROJECT_ID`          |                    |                | The project. Leave unset on GKE or Cloud Run, where Application Default Credentials apply.                                                     |
| `MEDIA_GCS_KEY_FILE`            |                    |                | A service-account key file, when not using Application Default Credentials.                                                                    |
| `MEDIA_GCS_SIGN_WITH_IAM`       | `false`            |                | Sign URLs through IAM instead of a private key (Workload Identity).                                                                            |
| `MEDIA_AZURE_CONTAINER`         |                    | when installed | The blob container uploads land in.                                                                                                            |
| `MEDIA_AZURE_CONNECTION_STRING` |                    | when installed | The storage account connection string.                                                                                                         |
| `BLOB_READ_WRITE_TOKEN`         |                    |                | The Vercel Blob token. Vercel sets it on its own platform; set it only elsewhere.                                                              |
| `MEDIA_DIRECT_SERVE`            | `off`              |                | off streams every download through the server; signed-url redirects an authorised download to the storage backend. One of `off`, `signed-url`. |

- **`MEDIA_LOCAL_ROOT`** — Point it at a persistent volume in production: a container's own disk is wiped on every deploy.
- **`MEDIA_S3_ACCESS_KEY_ID`** — Leave both keys unset on a host with an instance role or IRSA: the SDK finds those itself, and keys here would take their place.
- **`MEDIA_GCS_SIGN_WITH_IAM`** — Needs the iam.serviceAccounts.signBlob permission.
- **`MEDIA_AZURE_CONNECTION_STRING`** — For a managed identity, build the container client in plugins.ts instead — see the package docs.
- **`BLOB_READ_WRITE_TOKEN`** — Every blob in the store gets a permanent public URL: anyone who has one can fetch the file without signing in.

## Mail

| Variable            | Default     | Required       | What it is                                                                                                         |
| ------------------- | ----------- | -------------- | ------------------------------------------------------------------------------------------------------------------ |
| `MAIL_URL`          |             |                | Where messages are handed off. Unset, the server sends nothing.                                                    |
| `MAIL_FROM`         |             | when installed | The sender. Required once MAIL_URL is set.                                                                         |
| `MAIL_REPLY_TO`     |             |                | Where replies go, when not MAIL_FROM.                                                                              |
| `MAIL_PRODUCT_NAME` | `Ortha CMS` |                | What the messages call the product.                                                                                |
| `MAIL_REVEAL_LINKS` | `false`     |                | Also return invite and reset links in API responses. For chasing a message that did not arrive; turn it off again. |

- **`MAIL_URL`** — smtp:// upgrades with STARTTLS (port 587), smtps:// is implicit TLS (465); add ?requireTls=true to refuse a relay that cannot upgrade. console:// writes messages to the log, for development only. With no mail, the invite and reset routes return the link for an administrator to pass on; with mail they stop returning it.

## Single sign-on

| Variable                              | Default  | Required | What it is                                                                                                |
| ------------------------------------- | -------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `SSO_OIDC_ISSUER`                     |          |          | The OpenID Connect issuer. With a client id, it is what turns the provider on.                            |
| `SSO_OIDC_CLIENT_ID`                  |          |          | The OpenID Connect client id.                                                                             |
| `SSO_OIDC_CLIENT_SECRET`              |          |          | The client secret. Leave unset for a public client, which uses PKCE alone.                                |
| `SSO_OIDC_EMAIL_VERIFIED_WHEN_ABSENT` | `false`  |          | Treat addresses as verified when the provider sends no email_verified claim.                              |
| `SSO_GITHUB_CLIENT_ID`                |          |          | The GitHub OAuth app client id.                                                                           |
| `SSO_GITHUB_CLIENT_SECRET`            |          |          | The client secret. Required: GitHub has no PKCE, so it is what proves the code is redeemed by this app.   |
| `SSO_GITHUB_ENTERPRISE_URL`           |          |          | A GitHub Enterprise Server root. Unset for github.com.                                                    |
| `SSO_SAML_ENTRY_POINT`                |          |          | The identity provider's single sign-on URL. With the certificate, it is what turns SAML on.               |
| `SSO_SAML_IDP_CERT`                   |          |          | The identity provider's signing certificate, PEM or base64.                                               |
| `SSO_SAML_ISSUER`                     |          |          | The entity id the identity provider registered for this app. Defaults to API_PUBLIC_URL, then PUBLIC_URL. |
| `SSO_SAML_SUBJECT_ATTRIBUTE`          |          |          | The attribute holding a stable id for the person. Set it whenever the NameID is an email address.         |
| `SSO_SAML_EMAIL_VERIFIED`             | `false`  |          | Treat addresses from the identity provider as verified.                                                   |
| `SSO_PROVISION_DOMAINS`               |          |          | Email domains an account may be created for on first sign-in. Unset, SSO signs in existing accounts only. |
| `SSO_PROVISION_ROLE`                  | `viewer` |          | The role a provisioned account starts with.                                                               |
| `SSO_ALLOW_PASSWORD_LOGIN`            | `true`   |          | Set false to make single sign-on the only way in. The root administrator keeps a password regardless.     |

- **`SSO_OIDC_ISSUER`** — Must match the iss claim byte for byte, trailing slash included. Register <PUBLIC_URL>/api/auth/sso/oidc/callback with the provider.
- **`SSO_OIDC_EMAIL_VERIFIED_WHEN_ABSENT`** — Microsoft Entra ID is the common case. That claim is the only gate on a first sign-in claiming an existing account, so setting this asserts your directory owns the addresses it reports.
- **`SSO_GITHUB_CLIENT_ID`** — Register <PUBLIC_URL>/api/auth/sso/github/callback as the callback URL.
- **`SSO_SAML_IDP_CERT`** — An environment variable cannot hold real newlines: write them as \n, or point SSO_SAML_IDP_CERT_FILE at the file.
- **`SSO_SAML_SUBJECT_ATTRIBUTE`** — An address follows a mailbox, not a person, and a profile whose subject is one is refused.
- **`SSO_SAML_EMAIL_VERIFIED`** — SAML carries no verification claim at all; setting this asserts your directory owns the addresses it reports.

## Copilot

| Variable                         | Default                                          | Required | What it is                                                                                                          |
| -------------------------------- | ------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------- |
| `COPILOT_ENABLED`                | `false`                                          |          | Offer the copilot at all.                                                                                           |
| `ANTHROPIC_API_KEY`              |                                                  |          | The Anthropic API key. Setting it is what registers Claude.                                                         |
| `ANTHROPIC_BASE_URL`             |                                                  |          | A gateway or proxy to use instead of api.anthropic.com.                                                             |
| `COPILOT_ANTHROPIC_MODELS`       | `claude-opus-5,claude-sonnet-5,claude-haiku-4-5` |          | The Claude models people may pick, comma-separated. The first is the default.                                       |
| `COPILOT_OPENAI_BASE_URL`        |                                                  |          | An OpenAI-compatible endpoint: Ollama, vLLM, LM Studio, LiteLLM, Azure or OpenAI. Setting it registers the backend. |
| `COPILOT_OPENAI_API_KEY`         |                                                  |          | That endpoint's key. Unset for a local runtime.                                                                     |
| `COPILOT_OPENAI_MODELS`          | `llama3.1`                                       |          | The models people may pick there. The first is the default.                                                         |
| `COPILOT_USER_DAILY_TOKENS`      |                                                  |          | Tokens one person may spend in one workspace per day (UTC). Unset is unlimited.                                     |
| `COPILOT_WORKSPACE_DAILY_TOKENS` |                                                  |          | Tokens all members of one workspace may spend per day (UTC). Unset is unlimited.                                    |
| `COPILOT_RUNS_PER_MINUTE`        |                                                  |          | Runs one person may start per minute. Unset is unlimited.                                                           |
| `COPILOT_MAX_CONCURRENT_RUNS`    |                                                  |          | Runs one person may have in flight at once. Unset is unlimited.                                                     |

- **`COPILOT_ENABLED`** — false removes every copilot route and the admin hides the panel. Turning it on with no backend configured refuses to start. It is not what keeps content in-house: no backend is registered without its key.

## Switches

| Variable                          | Default | Required | What it is                                                                                     |
| --------------------------------- | ------- | -------- | ---------------------------------------------------------------------------------------------- |
| `API_DOCS`                        |         |          | Publish the API reference on /reference and GraphiQL. On outside production unless set.        |
| `MCP_ENABLED`                     | `false` |          | Serve the Model Context Protocol endpoint on /api/v1/mcp.                                      |
| `WEBHOOKS_ALLOW_INSECURE_URLS`    | `false` |          | Allow http:// webhook destinations. For local development: the payload is readable on the way. |
| `WEBHOOKS_ALLOW_PRIVATE_NETWORKS` | `false` |          | Allow webhook destinations on loopback, link-local and private networks.                       |

- **`MCP_ENABLED`** — Once on, any holder of a full-scope API token can edit content from an external agent.
- **`WEBHOOKS_ALLOW_PRIVATE_NETWORKS`** — Off because a webhook is the server requesting an address a user typed, the shape of every SSRF. Turn it on only when the receiver really is inside this network.

## Development only

| Variable                 | Default       | Required | What it is                                                                                                         |
| ------------------------ | ------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `SCHEMA_BUILDER`         | `false`       |          | Let the Content model page edit types. It writes code, so it is refused in production whatever this says.          |
| `SCHEMA_BUILDER_ROOT`    | `apps/server` |          | The server app's folder, relative to where the server is started.                                                  |
| `SCHEMA_BUILDER_RESTART` | `watch`       |          | watch waits for the dev watcher to restart the server after an edit; manual asks you to. One of `watch`, `manual`. |
| `ADMIN_PORT`             | `4200`        |          | The port the admin dev server listens on.                                                                          |
| `API_PORT`               |               |          | Where the admin dev server proxies /api, when not PORT — an API from another checkout.                             |

## Renamed

Still read under the old name, with a warning at boot. The new name wins when both are set.

| Old name                                                                                                   | New name                                                 |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `APP_URL`                                                                                                  | `PUBLIC_URL`                                             |
| `SSO_PUBLIC_BASE_URL`                                                                                      | `API_PUBLIC_URL`                                         |
| `SSO_GITHUB_ENTERPRISE_BASE_URL`                                                                           | `SSO_GITHUB_ENTERPRISE_URL`                              |
| `ALLOWED_ORIGINS`                                                                                          | `PUBLIC_URL`, plus `EXTRA_ORIGINS` for any other address |
| `MAIL_PROVIDER`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_REQUIRE_TLS` | `MAIL_URL`                                               |

## No longer read from the environment

Set to its old default, a variable below only logs a warning — remove the line. Set to anything else, the server refuses to start and says where the value goes now, because ignoring it would change the deployment without a word.

| Variable                         | Old default            | Set it in                                                                                               |
| -------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------- |
| `MAX_REQUEST_BODY`               | `1mb`                  | `bodyLimit` in orthacms.config.ts                                                                       |
| `OUTBOX_RETENTION_DAYS`          | `30`                   | `database.outboxRetentionDays` in orthacms.config.ts                                                    |
| `SESSION_TTL_SECONDS`            | `604800`               | `plugins.identity` in config/identity.ts                                                                |
| `INVITE_TTL_SECONDS`             | `604800`               | `plugins.identity` in config/identity.ts                                                                |
| `RESET_TTL_SECONDS`              | `3600`                 | `plugins.identity` in config/identity.ts                                                                |
| `LOGIN_RATE_LIMIT`               | `10`                   | `plugins.identity` in config/identity.ts                                                                |
| `LOGIN_RATE_LIMIT_TTL_SECONDS`   | `60`                   | `plugins.identity` in config/identity.ts                                                                |
| `SSO_REQUEST_TTL_SECONDS`        | `600`                  | `plugins.identity` in config/identity.ts                                                                |
| `SSO_SESSION_TTL_SECONDS`        |                        | `plugins.identity` in config/identity.ts                                                                |
| `SSO_OIDC_NAME`                  | `oidc`                 | the `oidc` provider in config/identity.ts                                                               |
| `SSO_OIDC_LABEL`                 |                        | the `oidc` provider in config/identity.ts                                                               |
| `SSO_OIDC_SCOPES`                | `openid,profile,email` | the `oidc` provider in config/identity.ts                                                               |
| `SSO_GITHUB_NAME`                | `github`               | the `github` provider in config/identity.ts                                                             |
| `SSO_GITHUB_LABEL`               | `GitHub`               | the `github` provider in config/identity.ts                                                             |
| `SSO_GITHUB_SCOPES`              | `read:user,user:email` | the `github` provider in config/identity.ts                                                             |
| `SSO_GITHUB_ORG`                 |                        | the `github` provider in config/identity.ts                                                             |
| `SSO_GITHUB_ORGANIZATION`        |                        | the `github` provider in config/identity.ts                                                             |
| `SSO_SAML_NAME`                  | `saml`                 | the `saml` provider in config/identity.ts                                                               |
| `SSO_SAML_LABEL`                 | `SAML`                 | the `saml` provider in config/identity.ts                                                               |
| `SSO_SAML_EMAIL_ATTRIBUTE`       |                        | the `saml` provider in config/identity.ts                                                               |
| `SSO_SAML_NAME_ATTRIBUTE`        |                        | the `saml` provider in config/identity.ts                                                               |
| `SSO_SAML_GROUPS_ATTRIBUTE`      |                        | the `saml` provider in config/identity.ts                                                               |
| `MEDIA_MAX_UPLOAD_BYTES`         | `52428800`             | `plugins.media` in config/media.ts                                                                      |
| `MEDIA_DIRECT_SERVE_TTL_SECONDS` | `300`                  | `plugins.media` in config/media.ts                                                                      |
| `COPILOT_MAX_OUTPUT_TOKENS`      | `8192`                 | `plugins.copilot` in config/copilot.ts                                                                  |
| `COPILOT_MAX_STEPS`              | `30`                   | `plugins.copilot` in config/copilot.ts                                                                  |
| `COPILOT_WALL_CLOCK_MS`          | `300000`               | `plugins.copilot` in config/copilot.ts                                                                  |
| `COPILOT_MAX_TOTAL_TOKENS`       | `400000`               | `plugins.copilot` in config/copilot.ts                                                                  |
| `GRAPHQL_MAX_DEPTH`              | `8`                    | `plugins.contentGraphql` in config/graphql.ts                                                           |
| `GRAPHQL_MAX_COMPLEXITY`         | `1000`                 | `plugins.contentGraphql` in config/graphql.ts                                                           |
| `GRAPHQL_MAX_FIELDS`             | `500`                  | `plugins.contentGraphql` in config/graphql.ts                                                           |
| `GRAPHQL_MAX_QUERY_LENGTH`       | `16384`                | `plugins.contentGraphql` in config/graphql.ts                                                           |
| `GRAPHQL_SCHEMA_CACHE_TTL_MS`    | `60000`                | `plugins.contentGraphql` in config/graphql.ts                                                           |
| `MCP_CALL_TIMEOUT_MS`            | `30000`                | `plugins.mcp` in config/mcp.ts                                                                          |
| `MCP_MAX_RESULT_BYTES`           | `4194304`              | `plugins.mcp` in config/mcp.ts                                                                          |
| `SEGMENTS_READER_TAGS_HEADER`    | `x-reader-tags`        | the resolver in config/segments.ts                                                                      |
| `WEBHOOKS_DELIVERY_INTERVAL`     | `2000`                 | ORTHACMS_WORKERS=false (to stop sending from this process), or `plugins.webhooks` in config/webhooks.ts |
| `WEBHOOKS_TIMEOUT`               | `10000`                | `plugins.webhooks` in config/webhooks.ts                                                                |
| `WEBHOOKS_RETENTION_DAYS`        | `30`                   | `plugins.webhooks` in config/webhooks.ts                                                                |
| `MAIL_DELIVERY_INTERVAL_MS`      | `2000`                 | ORTHACMS_WORKERS=false (to stop sending from this process), or `plugins.mail` in config/mail.ts         |
| `MAIL_MAX_ATTEMPTS`              | `5`                    | `plugins.mail` in config/mail.ts                                                                        |
| `SMTP_CONNECTION_TIMEOUT_MS`     |                        | `plugins.mail` in config/mail.ts                                                                        |
