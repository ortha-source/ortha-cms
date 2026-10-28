# @orthacms/config

**Which environment variables an Ortha CMS server reads, and how each is
read.** One catalog, the builders that read it, and the files generated from
it. Framework-free: it depends on `@orthacms/utils-server`'s readers and
nothing else, so a host, the scaffolder's template, `orthacms doctor` and
`orthacms setup` can all load it without booting Nest.

## Why it exists

This repository's `apps/server/config/` and the scaffolder's template each read
the environment themselves, and they drifted: the template read
`SSO_GITHUB_ENTERPRISE_BASE_URL` where the host read
`SSO_GITHUB_ENTERPRISE_URL`, one side supported settings the other ignored, and
`.env.example` (397 lines) documented variables by hand. Now both apps call the
same builders, and `.env.example`, `env.tmpl` and `docs/configuration.md` are
rendered from the same list.

## What is here

| File               | What it is                                                                                                                                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/catalog.ts`   | `ENV_CATALOG` — every variable: group, kind, default, when required, which scaffolder features read it, old names. **The only place a variable is added.**                                                                        |
| `lib/urls.ts`      | `PUBLIC_URL` (dev default: the admin dev server; none in production), `API_PUBLIC_URL`, and `allowedOrigins()`, which derives the sign-in origins from them.                                                                      |
| `lib/server.ts`    | Port, `TRUST_PROXY`, `DATABASE_URL`, `ORTHACMS_WORKERS`, `API_DOCS`, `MCP_ENABLED`, webhooks' URL policy, the schema builder, the root admin.                                                                                     |
| `lib/mail.ts`      | `MAIL_URL` (`smtp://`, `smtps://`, `console://`) → backend + relay; the legacy `MAIL_PROVIDER` + `SMTP_*`, read with a warning.                                                                                                   |
| `lib/sso.ts`       | OIDC, GitHub, SAML connection settings, plus the `sso` block (provisioning, password login). **Names, labels and scopes are not here — they are code in the host.**                                                               |
| `lib/storage.ts`   | Local, S3, GCS, Azure, Vercel Blob, and `MEDIA_DIRECT_SERVE`.                                                                                                                                                                     |
| `lib/copilot.ts`   | The kill switch, the two backends, the usage quotas.                                                                                                                                                                              |
| `lib/retired.ts`   | `RETIRED_ENV` and `checkRetiredEnv()` — variables no longer read (now code), with their old default and new home.                                                                                                                 |
| `lib/inspect.ts`   | `inspectEnvironment()` — every variable with its source (env, `_FILE`, old name, default), masked; the builders' refusals collected instead of thrown; production pitfalls. What `orthacms doctor` and `orthacms setup` stand on. |
| `lib/render.ts`    | `renderEnvFile` (`.env`-shaped, plain or with `orthacms:if` blocks) and `renderConfigReference` (Markdown).                                                                                                                       |
| `lib/generated.ts` | The three generated files and their paths.                                                                                                                                                                                        |

## Rules

- **Add a variable to the catalog and a builder together.** `catalog.spec.ts`
  runs every builder under a `process.env` proxy and fails on a name read and
  not listed, or listed and not read.
- **Regenerate after editing the catalog**:
  `ORTHACMS_WRITE_GENERATED=1 npx nx test config`. `generated.spec.ts` fails
  while `.env.example`, the template's `env.tmpl` or `docs/configuration.md` is
  stale.
- **A setting no deployment varies per environment is code, not a variable.**
  Lifetimes, rate limits, GraphQL budgets, retry counts and provider names live
  as literals in the host's `config/`. A variable set by accident would change
  a security setting in silence; a literal changes in a reviewed diff.
- **Retiring a variable goes in `RETIRED_ENV`**, never just deleted: set to its
  old default it warns, set to anything else the server refuses to start and
  says where the value goes. Ignoring a value someone set is the one thing a
  retirement must not do.
- **Renaming goes in `RENAMED`** (`@orthacms/utils-server`) and in the
  catalog's `previously` — `catalog.spec.ts` checks the two agree. `readEnv`
  falls back to the old name with a one-time warning.
- **Builders return structural types**, not the provider packages' own: a
  generated app installs one storage adapter, and this package must not drag in
  the other four. The host's typecheck is what proves a builder's shape still
  fits the factory it is handed to.

## Commands

- `npx nx test config`
- `ORTHACMS_WRITE_GENERATED=1 npx nx test config` — rewrite the generated files
