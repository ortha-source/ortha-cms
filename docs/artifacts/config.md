# config

`@orthacms/config` decides which environment variables an Ortha CMS server
reads, what each value has to look like, and what the documentation says about
it. It owns no table, no route and no Nest module.

## What it is for

A self-hosted CMS is configured by people who did not write it, from a
dashboard or a `.env` file, often once. Two failure modes dominated before this
package existed:

- **Drift.** This repository's server and the scaffolder's template each read
  the environment with their own code. A setting copied from one to the other
  could be spelled differently and do nothing.
- **Too many knobs.** 115 variable names across the two, most of them tuning
  nobody changes — and each one a way to loosen a security setting by accident
  (`LOGIN_RATE_LIMIT`, `GRAPHQL_MAX_DEPTH`) with nothing in the log.

Now there is one catalog, one set of builders both apps call, and everything
that describes the environment is generated from the catalog.

## How a value travels

1. The host's `orthacms.config.ts` calls `checkRetiredEnv()` first.
2. Each module in `config/` calls a builder (`mailFromEnv`, `oidcFromEnv`, …)
   and adds what is code: lifetimes, limits, provider names.
3. The builder reads through `@orthacms/utils-server`: empty is unset, a
   `NAME_FILE` twin is read from disk, an old name is read with a warning, and a
   value that does not fit refuses to start, naming the variable.

## The variables that changed shape

| Was                                                 | Is                                                  |
| --------------------------------------------------- | --------------------------------------------------- |
| `ALLOWED_ORIGINS`, `SSO_PUBLIC_BASE_URL`, `APP_URL` | `PUBLIC_URL` (+ `EXTRA_ORIGINS`, `API_PUBLIC_URL`)  |
| `MAIL_PROVIDER` + six `SMTP_*`                      | `MAIL_URL`                                          |
| `WEBHOOKS_DELIVERY_INTERVAL=0`, `MAIL_DELIVERY_…`   | `ORTHACMS_WORKERS=false`                            |
| 41 tuning variables                                 | literals in `config/` (see `docs/configuration.md`) |

## Invariants

- **I-01** — Every variable a builder reads is in `ENV_CATALOG`, and every
  variable in it is read by a builder (or by the admin's Vite config:
  `ADMIN_PORT`, `API_PORT`). `catalog.spec.ts`.
- **I-02** — `.env.example`, `templates/default/env.tmpl` and
  `docs/configuration.md` equal what the catalog renders. `generated.spec.ts`.
- **I-03** — A retired variable set to its old default warns; set to anything
  else, the server refuses to start and names where the value goes.
- **I-04** — An old name is read only when the current name is unset, warns
  once per process, and appears in both `RENAMED` and the catalog's
  `previously`.
- **I-05** — Production without `PUBLIC_URL` refuses to start (unless the legacy
  `ALLOWED_ORIGINS` is set). Outside production the allowed origins include both
  the admin dev server and `http://localhost:<PORT>`, because a browser sends
  `Origin` on same-origin POSTs and `npm start` serves the admin from `PORT`.
- **I-06** — `MAIL_URL` naming a backend the app has not installed refuses to
  start; it never reads as "send nothing".
- **I-07** — `smtp://` leaves `secure` unset (STARTTLS); only `smtps://` sets it.
- **I-08** — `ORTHACMS_WORKERS=false` hands both the webhook and the mail worker
  an interval of `0`; nothing else stops either from sending.
- **I-09** — A flag accepts `true`/`false`/`1`/`0` in any case and refuses
  anything else; an enum refuses anything outside its list.
- **I-10** — `NAME_FILE` is read only when `NAME` is unset; a `NAME_FILE` that
  cannot be read refuses to start.
- **I-11** — An SSO provider's name is code, never a variable: renaming it
  orphans every `sso_identities` row that refers to it.
