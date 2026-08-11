# Build prompt — Ortha CMS marketing website

> A self-contained brief for an AI coding agent (or a human) to build the Ortha
> CMS marketing site from scratch, in a **standalone repository**, with no access
> to the product codebase. Every product fact below was verified against the
> `ortha-source/ortha-cms` repo at `v0.2.2`. Facts are load-bearing: **do not
> invent features, metrics, customers, testimonials, or pricing.**

---

## 0. Copy-paste prompt

Everything from §1 to §14 is the prompt. Hand it over whole. The sections are
ordered so an agent can read top-to-bottom and start building at §9.

---

## 1. Mission

Build the marketing website for **Ortha CMS** — an open-source, self-hosted,
plugin-based, AI-native headless CMS.

The site has exactly one job: **convince a technical decision-maker to run
`git clone` within five minutes of landing.** Every section either builds
belief or removes a reason to leave. There is no sales team, no demo booking,
no trial signup — the conversion event is a GitHub star, an `npm install`, or a
clone.

Deliverable: a production-ready static site in a new repository, deployable to
any static host or behind Nginx/Caddy on the operator's own box.

---

## 2. What Ortha CMS actually is (verified product truth)

Read this whole section before writing a single line of copy. It is the factual
ground for the site.

### One-line definition

A plugin-based, self-hosted headless CMS built on PostgreSQL, where content
types are declared in code and compiled into real Postgres tables — and where AI
agents are a first-class client, not a bolt-on.

### The three-sentence version

Ortha is a small, generic **host** that turns a list of **plugins** into a
running application. Capability lives in plugins — content, media, i18n, users,
workspaces, audit, AI — so you add features by adding a package and a line in a
list, never by editing the core. It ships an admin SPA, a REST content API, a
GraphQL API, and a Model Context Protocol server, all sharing one permission
model.

### Verified stack

| Layer | Technology |
| --- | --- |
| Admin UI | React 19 + Vite 8, TanStack Query/Form, react-intl, shadcn/ui + Tailwind v4 |
| API | NestJS 11 (Express 5), TypeScript 5.9 |
| Database | PostgreSQL 16, Drizzle ORM 0.45 |
| Rich text | TipTap 3 / ProseMirror |
| Monorepo | Nx 22.7.5, npm workspaces |
| Runtime | Node 22 (CI standard; ≥20.12 minimum) |
| License | **MIT** |
| Current version | **0.2.2**, published as **37 packages** under the `@ortha-cms` npm scope, versioned in lockstep |

**The only runtime dependency an operator must provide is PostgreSQL.** No
Redis, no queue, no search cluster, no websocket server, no vector database.

### The feature set, as it exists

**Content modeling — code-defined, compiled to real tables.**
Content types are declared in a typed DSL — `collection('post', {…})` for
multi-entry types, `single()` for one-off pages — and compiled into real
`content_<name>` Postgres tables, not a generic EAV blob. Twelve field types:
`string`, `text`, `richtext`, `number`, `boolean`, `date`, `datetime`, `select`,
`json`, `slug`, `media`, `relation`. All four relation cardinalities including
many-to-many via generated join tables with a float `position` column, so link
order survives a reload. Three optional flags add platform-owned columns:
`publishable` (draft/published + `published_at`), `paranoid` (soft delete +
Trash), `i18n` (locale + locale group). **Invalid models fail at boot, not at
first request.**

**The editing surface.**
A records table with server-side search, a visual filter builder, sortable
columns, a drag-and-drop column picker, bulk actions, and URL-as-state (so any
view is a shareable link). Relation columns render the actual linked records in
a popover — never a raw UUID — from a preview shipped with the list at no extra
request. A schema-driven tabbed entry editor where **tabs are routes**, so a
locale switch or browser Back doesn't dump the author back on General. A live
**Publish Gate** lists every required-but-invalid field with pass/fail *before*
you press Publish; bulk publish runs a dry run first and returns a per-entry
verdict. Read-only genuinely means the form — without `content:update` the write
affordances are removed rather than greyed out, and text stays selectable so a
reader can copy out.

**Four status labels over two stored values:** `draft` + no timestamp = Draft;
`draft` + `published_at` = **Modified** (live content with unpublished edits);
`published` = Published; plus "Not saved yet" on a create form. This distinction
is a genuine differentiator — most CMSes collapse it.

**Version history.** Every save keeps an immutable snapshot of the whole
document in `content_entry_revisions`, with a side-by-side Current → Version N
diff, restore, and the ability to publish any earlier version. Restore is
append-only: restoring v2 yields a fresh v6 equal to v2, never a rewrite.

**Rich text.** Every `richtext` field renders a live preview that expands into a
full TipTap editor filling the record's work area — not a modal, so the sidebar,
Save/Publish and the live publish gate stay on screen. Callouts, tables, column
layouts, dividers, resizable images and video. Per-image alt-text control lives
on the image, with an explicit "Decorative" checkbox so "nobody wrote this yet"
is distinguishable from "this image carries no information." XSS-safe by
construction: the preview never renders stored HTML as-is — it round-trips
through the editor's own ProseMirror schema in an inert `DOMParser` document, so
only what the schema declares survives.

**Media Library.** Folder tree, searchable asset grid, detail drawer, bulk
select. Upload queue with per-file progress, retry and cancel, three at a time,
one request per file. Automatic WebP derivatives on upload via Sharp — `thumb`
(≤320px) and `preview` (≤1280px), never upscaled — so grids never load a
full-size original. Storage is a port: `StorageProvider` with `put`/`get`/
`remove`/`url`, local filesystem shipped, with an optional per-upload routing
handler. **"Route at write, record at read"** — the provider is chosen once on
upload and persisted on the row, so changing the handler never strands existing
blobs. Bytes never live in the database.

**Localization — row-per-locale.** Marking a type `i18n: true` makes each
language a full row; siblings share a `locale_group_id`. Per field you choose
`localized: true` or leave it **shared** (one value across every translation).
Editing a shared field rewrites every sibling, demotes published siblings to
draft while keeping `published_at` (so they read **Modified**), and re-validates
them — a draft edit can't silently invalidate a live translation. Relations
carry across languages by rule, not guesswork: `shared`, `mirrored`, or `none`.
Relations may not cross locales, enforced in the writer, not just the picker.
Translation coverage lands as an Insights card, counting **records, not rows** —
counting rows would report 40 stories in 3 languages as 120 things.

**Workspaces.** A workspace groups content, media, members and content-type
grants, with a 3-step create wizard and a tabbed settings page. Selecting one
swaps the entire app sidebar to that workspace's nav. **Membership decides
*where* a user may act; permissions decide *what* they may do. Both must pass.**
A non-member always gets a flat 403, never a 404, so IDs can't be enumerated.
No orphaned content, ever: deleting a workspace or revoking a content grant
returns 409 while entries exist, checked in one transaction under an exclusive
per-workspace advisory lock.

**Users and RBAC.** Invite-only — there is no public registration. Three system
roles (`admin`, `contributor`, `viewer`) seeded idempotently on every boot,
mapping to **23 permission keys** across six resources (`content:*`, `media:*`,
`users:*`, `workspaces:*`, `tokens:*`, `activity:read`, `copilot:use`,
`copilot:skills:manage`). The same keys gate the server (`@RequirePermissions` +
`PermissionsGuard`) and the UI (`useHasPermission`), so the admin never shows a
button that will 403. Sessions are DB-backed, revocable, httpOnly cookies —
only the SHA-256 *of* the session token is stored, so a read-only DB or backup
leak yields no usable sessions. Passwords are bcrypt; the 12–72 character rule
exists because 72 bytes is bcrypt's truncation point and Ortha rejects rather
than silently truncates. Last-admin protection is race-safe via
`pg_advisory_xact_lock`, not a UI hint. Disabling a user signs them out where
they sit.

**API tokens — one credential, three protocols.** A global API Tokens page mints
a long-lived bearer token over one *or more* workspaces, with `read` or `full`
scope and an optional expiry. The secret is revealed once, then never again.
That same token authenticates the REST API, the GraphQL API, **and** the MCP
server. Only the SHA-256 hash is stored. A token acts as itself — the minting
user's role grants are deliberately not consulted, so revoking the token is
enough to revoke its access. Unknown, revoked and expired tokens all return one
flat 401.

**Public REST content API (`/api/v1`).** Token-authenticated read and write:
list, get, per-relation paging, media resolution, translations, plus
create-draft / partial-update / publish / unpublish / delete for `full`-scope
tokens. Every read is published-only by default, workspace-scoped,
soft-delete-aware and locale-scoped. **Sparse fieldsets** (`?fields=title,slug`)
narrow the actual SQL projection, not just the JSON. Opt-in expansion for
relations, media and translations, each returning a full record. Every
single-entry route exists twice — under `:id` and under
`group/:localeGroupId` — so a localized front-end holds one stable ID per
*story* and varies `?locale=` alone. **Batched, not N+1, and measured:**
`pageSize=1` and `pageSize=50` each issue the same 6 content queries. `total`
never lies — a draft relation target is neither shown *nor counted*, because the
restriction goes inside the window (`count(*) over`). Self-documenting via an
interactive Scalar reference at `/reference` (raw OpenAPI at `/reference/json`).

**GraphQL API (`POST /api/v1/graphql`).** The same content, the same tokens, the
same guards, the same scopes, the same visibility rules — a protocol *adapter*,
not a second API. **The schema is built per workspace grant set, not once at
boot**, so introspection cannot enumerate types the workspace was not granted.
The GraphQL selection set becomes `?fields=` — asking `{ id title }` narrows the
SQL projection exactly as REST does, for free, because it is the same code path.
Every operation carries an explicit cost budget: query length 16 KB, depth 8,
30 aliases, complexity 1000, one operation per request. A self-contained
GraphiQL playground ships with no CDN dependency, which is what makes an
air-gapped install work. REST↔GraphQL parity is pinned by a field-by-field test.

**MCP server (`POST /api/v1/mcp`) — your CMS is a tool an agent can use.**
Claude Desktop, Cursor, or any MCP SDK client connects with an API token and
gets twelve generic content tools — `content_types_list`, `content_type_get`,
`content_list`, `content_get`, `content_relations`, `content_media`,
`content_translations`, `content_create`, `content_update`, `content_publish`,
`content_unpublish`, `content_delete` — plus media reads and `i18n_locales_list`.
Granted types are also exposed as MCP resources (`ortha://content-type/<slug>`).
**Twelve generic tools, not a set per content type**, because generating
`article_create`, `author_create`, … would put the whole content model in every
conversation's context. Stateless Streamable HTTP. The token's scope decides
which tools an agent can even see — a `read` token never learns `content_create`
exists. **Off by default** (`MCP_ENABLED=false`).

**Ortha AI — the built-in copilot.** Two surfaces onto one engine: a **non-modal
docked window** (⌘J, bottom-right, up to 3 concurrent chats, draggable and
resizable, geometry remembered) and a **full-page Agents view** at
`/workspaces/:id/agents` with a thread rail and a CMS ⇄ Agents switcher that
returns you to the page you left. The URL is the thread — deep-linkable,
reload-safe, Back-button navigable. A run keeps streaming when you navigate
away; the tab title and favicon signal when a chat wants you back.

It can search content (free text, structured filters, sorting, paging, locales,
sparse fieldsets), read entries and revisions, diff versions, list locales and
translations, search media, read a file, list workspace members, read the
activity log — and write: propose and apply a content create or update, a
translation into another locale, alt text on an asset, or author a new file into
the Media Library. Escape minimizes rather than closes, so the run survives.

**Bring your own model — including fully local.** Three shipped adapters:
native Claude via the Anthropic SDK; **any OpenAI-wire-format endpoint** via one
configurable `baseUrl` — Ollama, vLLM, llama.cpp, LM Studio, LiteLLM,
OpenRouter, Azure, OpenAI; and a scripted deterministic fake that needs no key
and no network, so a fresh clone boots and CI runs the whole loop offline. The
default out-of-the-box OpenAI-compatible target is a local Ollama. Switch
provider with one environment variable and no redeploy; switch model mid-
conversation from a per-turn picker. Adding another backend is a package plus a
line — the copilot core imports no vendor SDK. **API keys live only in server
config and never reach the browser**; the models endpoint returns names only.

**AI safety properties worth naming.**
- *The copilot acts as its user, never as itself.* A run holds exactly the
  caller's permissions, so **a viewer's copilot is provably read-only**. There is
  no service account and no elevated AI identity.
- *There is no publish tool at any role.* The copilot may prepare a publishable
  draft; a person presses publish.
- *Writes ask in the moment, then apply.* Three buttons in the transcript —
  allow once / allow for this chat / don't allow. No "always". The grant dies
  with the thread. The run parks **before** a write executes, so a tool the model
  was talked into by poisoned content never runs at all.
- *Prompt-injection defence is structural, not detection-based.* Every tool
  result is wrapped in a fence; the payload is JSON so no field value can
  introduce a line that reads as a new turn, and `<` is escaped so the closing
  delimiter is unforgeable from inside. Unit-tested against a forged fence.
- *Bounded runs.* Three simultaneous ceilings — 8 steps, 120 seconds, 120k
  tokens — plus a per-response output cap. Every stop reason is shown to the user
  in a sentence; nothing stops silently.
- *Every attempted tool call is audited*, including refusals, with tool name,
  input, outcome and duration.
- *Off by default* (`COPILOT_ENABLED=false`), because enabling a hosted provider
  sends workspace content to a third party — an operator opts in explicitly.

**Insights.** A per-workspace dashboard with a range picker and thirteen cards
across four bands: entries/published/drafts tiles, "Gone quiet" staleness
buckets, draft-vs-published by type, publishing velocity, "Waiting to go live",
a team punchcard (edits by weekday × hour), storage breakdown by count *and*
bytes, uploads over time, images missing alt text, and translation coverage. The
dashboard itself contributes **no widgets and imports no feature package** —
every card arrives through a slot. Each widget owns its own request, so a slow
aggregate degrades one card instead of blanking the page, and every card
distinguishes error from empty because "nothing needs attention" and "we
couldn't ask" look identical and mean opposite things.

**Audit trail.** A filterable, sortable, deep-linkable global activity log
covering auth, member lifecycle, workspace lifecycle and content. Rows are
written by a **transactional outbox** subscriber and are idempotent by
construction — the primary key is the source event ID and the insert is
`ON CONFLICT DO NOTHING`, so a re-delivered event never double-records. The
audit outlives its subjects: `actor_id` carries no foreign key and `actor_email`
is a frozen snapshot.

**⌘K command palette and a visual query builder.** Nested AND/OR groups,
condition chips, and a relation-aware field picker that walks into relations —
`author.name`, `author.company.name` — to a 2-hop budget, with a lazily
paginated record picker as the value editor. Operators include equals, contains,
is one of, is empty, between, comparisons, and "within last N". **The filter
picker can never offer a path the API rejects** — one traversal produces both the
UI's field list and the SQL schema the endpoint enforces, pinned by a drift test.

**Plugin architecture.** `createAdmin({ plugins })` and
`createServer({ plugins })`. The host owns no domain logic — no auth, no users,
no content. Adding a capability is adding a plugin and registering it; you never
edit the host. Server plugins own their own Drizzle schema *and* migrations, each
with its own tracking table, so plugins version independently. Two decoupling
mechanisms: **admin slots** (named UI extension points contributed as pure data —
the Content Library alone exposes eleven) and **server DI ports** (a Symbol +
interface the depended-upon plugin declares and injects optionally, bound by the
implementer, keeping the package graph acyclic). The proof it works:
`wysiwyg-admin` contributes no route, no nav entry and no page — its entire
surface is one slot contribution; `i18n-admin` contributes nine slot items and
no routes at all.

**Accessibility.** WCAG 2.1 AA is a hard requirement, with axe scans and
dedicated keyboard suites in the e2e harness. Contrast is measured, not
asserted. Every user-facing string goes through react-intl.

**Testing.** Two e2e harnesses: Playwright Page Objects with the API mocked at
the network layer (including accessibility and keyboard suites), and an
in-process Postgres testcontainer with supertest for the API.

### Self-hosting, exactly

```sh
npm install
cp .env.example .env          # set DATABASE_URL, SESSION_SECRET, TOKEN_SECRET
docker compose up -d          # Postgres 16
npx nx run server:db:migrate  # applies every plugin's pending migrations
npm run dev                   # API on :3000, admin on :4200
```

Set `ORTHA_ROOT_ADMIN_EMAIL` / `ORTHA_ROOT_ADMIN_PASSWORD` and the first admin is
provisioned on boot — idempotent and non-destructive.

Both AI features are **off by default** and must be explicitly enabled. Media
defaults to the local filesystem. The API reference and GraphQL playground are on
outside production and can be published or disabled with one variable.

---

## 3. Positioning and messaging strategy

### The competitive frame

The self-hosted headless CMS category is dominated by **Strapi, Payload,
Directus, Ghost and Keystone**. Buyers arrive already comparing. Do not attack
them by name anywhere on the site — punching down reads as insecurity and ages
badly. Instead, win on the axis none of them owns.

### The wedge: AI is a client, not a feature

Every competitor is currently bolting a chat box onto an admin panel. Ortha's
claim is structurally different and provably true:

> **Ortha treats an AI agent as a first-class API client, governed by the same
> permission model as a human.**

Three proof points nobody else can copy quickly:
1. **One tool registry, two surfaces.** The built-in copilot and the external MCP
   endpoint call the *same* authorized tool registry. There is no second code
   path to keep in sync and no second place to forget a check.
2. **The copilot acts as its user.** It holds exactly the caller's permissions.
   A viewer's copilot is provably read-only. There is no AI service account.
3. **Bring your own model, including one that never leaves your network.** One
   `baseUrl` covers Ollama, vLLM, llama.cpp, LM Studio, LiteLLM, OpenRouter,
   Azure and OpenAI. Local inference is a setting, not a fork.

### The secondary wedge: it's Postgres, and it's yours

Content types compile to real tables. You can query them. You can back them up
with `pg_dump`. You can join them with the rest of your data. There is no
proprietary storage format and no vendor to lose access to. MIT licensed, no
open-core, no paid tier gating features, no cloud upsell.

### Positioning statement (internal, not for the page)

For engineering teams who need a content platform they fully control, Ortha CMS
is an open-source headless CMS that models content in code against Postgres and
treats AI agents as governed API clients — unlike Strapi or Directus, which
retrofit AI onto an admin UI, and unlike hosted platforms, which own your data.

### Audiences, in priority order

1. **The technical evaluator** (staff/lead engineer, CTO at a 10–100 person
   company). Decides. Wants the stack, the license, the data model, the security
   posture, and the escape hatch. Reads code samples before prose.
2. **The platform/infra engineer.** Will operate it. Wants the dependency list,
   the environment variables, the migration story, the scaling caveats.
3. **The AI-forward builder.** Arrived via "MCP CMS" or "self-hosted AI CMS".
   Wants to know it works with a local model and their own agent.
4. **The content lead.** Influences, rarely decides. Needs to see the editor and
   believe their team won't hate it. Serve them with screenshots, not paragraphs.

### Tone

Precise, confident, unhyped. The product's own documentation is written with
unusual care and dry wit — match it. Concrete numbers beat adjectives every
time: "the same 6 queries at `pageSize=1` and `pageSize=50`" is worth more than
"blazing fast". Never use "revolutionize", "unleash", "supercharge",
"game-changing", or "10x". Never claim enterprise scale, uptime, or customer
counts. Sentence case for all headings.

### Message hierarchy

- **H1 (the promise):** the CMS your agents can use, and your team owns.
- **H2 (the mechanism):** content modeled in code, compiled to Postgres,
  delivered over REST, GraphQL and MCP.
- **H3 (the proof):** MIT, self-hosted, one dependency, AI off by default,
  bring your own model.

### Objection map — address each explicitly somewhere on the page

| Objection | Where it's answered |
| --- | --- |
| "Another CMS?" | The AI-as-client wedge, above the fold |
| "AI means my content goes to a vendor" | Local models + off-by-default + keys never leave the server |
| "Code-defined types means devs gate every change" | Show the editor: authors work in the UI; only the *model* is code |
| "v0.2.2 is early" | Be honest and specific — see §12 |
| "Self-hosting is a burden" | Postgres + Node, one compose file, five commands |
| "Will I be locked in?" | MIT, real Postgres tables, `pg_dump`, 37 packages on npm |

---

## 4. SEO strategy

### Primary keyword targets

Realistic given a new domain and zero authority. Rank for the long tail first.

| Priority | Query | Intent | Where it wins |
| --- | --- | --- | --- |
| P0 | `self-hosted headless CMS` | evaluation | homepage H1 region + `/self-hosting` |
| P0 | `open source AI CMS` | evaluation | homepage + `/ai` |
| P0 | `MCP server CMS` / `CMS Model Context Protocol` | discovery, low competition, high intent | `/ai` |
| P1 | `headless CMS with local LLM` / `Ollama CMS` | discovery | `/ai` |
| P1 | `plugin based headless CMS` | evaluation | `/architecture` |
| P1 | `PostgreSQL headless CMS` | evaluation | `/features` |
| P1 | `code first content modeling` | evaluation | `/features` |
| P2 | `Strapi alternative self-hosted` | comparison | a future `/compare` page — **not** in v1 |
| P2 | `headless CMS GraphQL REST` | evaluation | `/features` |
| P2 | `MIT license CMS` | evaluation | footer + `/self-hosting` |

`MCP server CMS` and `headless CMS with local LLM` are the two queries where
Ortha can plausibly rank first within months. Weight them accordingly.

### Technical SEO requirements

- **Static HTML, server-rendered at build.** No client-side routing for primary
  content. Every indexable word must be in the initial HTML payload.
- One `<h1>` per page. A strict, non-skipping heading hierarchy.
- Unique `<title>` (50–60 chars) and `<meta name="description">` (140–160 chars)
  per page, authored — never templated from the H1.
- Canonical URL on every page. `og:` and `twitter:` cards with a generated 1200×630
  image per page.
- `sitemap.xml` and `robots.txt`, generated at build.
- **JSON-LD structured data:**
  - `SoftwareApplication` on the homepage (`applicationCategory`,
    `operatingSystem: "Linux, macOS, Windows"`, `license`, `offers` with
    `price: "0"`).
  - `FAQPage` on the FAQ section — this is the highest-leverage schema here,
    because it wins rich results on exactly the comparison queries above.
  - `BreadcrumbList` on interior pages.
  - `Organization` sitewide.
- **Semantic HTML.** `<main>`, `<section>` with `aria-labelledby`, real `<nav>`,
  a `<table>` for the comparison table. Never a `<div>` where an element exists.
- Descriptive `alt` on every screenshot — write them as sentences describing what
  the screen shows, because they double as accessibility and as image-search
  surface.
- Internal links with descriptive anchor text, never "click here" or "learn more"
  as the entire link.
- **Core Web Vitals budget:** LCP < 1.2s on a simulated 4G connection, CLS < 0.05,
  INP < 200ms. Total JS shipped to the homepage **under 30 KB gzipped**. Every
  image lazy-loaded below the fold with explicit `width`/`height` to reserve
  space. Fonts self-hosted, subset, `font-display: swap`, preloaded.
- Lighthouse ≥ 98 on Performance, Accessibility, Best Practices and SEO.
  This is a hard acceptance criterion, not a goal.

### Content SEO

- Lead every section with the answer, then the detail. The first 160 characters
  under a heading should be independently quotable as a featured snippet.
- Use the product's real vocabulary — `row-per-locale`, `sparse fieldsets`,
  `transactional outbox`, `Model Context Protocol`, `advisory lock`. These are
  the exact terms the target audience searches for, and they signal competence.
- The FAQ section is not filler. Write 8–10 questions in the phrasing a real
  evaluator would type, and answer each in under 60 words.

---

## 5. Visual identity

### Palette — use these exact values

These are the product's own design tokens, verbatim. Using them makes the site
feel continuous with the app, and makes the screenshots sit natively on the page.
The identity is: **a near-black ink neutral, true-gray surfaces, and one vivid
flame-orange accent.**

```css
:root {
    /* Core neutrals — light */
    --background:        oklch(1 0 0);
    --foreground:        oklch(0.21 0.012 285);
    --card:              oklch(1 0 0);
    --muted:             oklch(0.975 0.003 285);
    --muted-foreground:  oklch(0.49 0.015 285);
    --border:            oklch(0.9 0.008 285);

    /* Ink primary — buttons, the logo badge */
    --primary:            oklch(0.25 0.015 285);
    --primary-foreground: oklch(0.985 0 0);

    /* Flame orange — the one accent */
    --brand:                  oklch(0.66 0.2 35);
    --brand-foreground:       oklch(0.21 0.012 285);
    --brand-text:             oklch(0.55 0.18 35);   /* AA-safe orange for text */
    --brand-soft:             oklch(0.955 0.025 40);
    --brand-soft-foreground:  oklch(0.47 0.16 35);

    /* Semantic */
    --success: oklch(0.52 0.14 150);
    --warning: oklch(0.55 0.12 66);
    --info:    oklch(0.52 0.17 255);
    --destructive: oklch(0.55 0.22 27);

    /* Accents for iconography / geometry (L ≥ 0.72, safe on dark) */
    --nav-orange: oklch(0.72 0.17 40);
    --nav-blue:   oklch(0.74 0.11 250);
    --nav-green:  oklch(0.74 0.13 150);
    --nav-violet: oklch(0.76 0.11 300);
    --nav-amber:  oklch(0.78 0.13 80);
    --nav-teal:   oklch(0.75 0.1 190);

    --radius: 0.625rem;
}

:root[data-theme='dark'] {
    --background:       oklch(0.175 0.012 285);
    --foreground:       oklch(0.95 0.004 285);
    --card:             oklch(0.215 0.012 285);
    --muted:            oklch(0.25 0.006 285);
    --muted-foreground: oklch(0.72 0.012 285);
    --border:           oklch(0.3 0.008 285);

    --primary:            oklch(0.92 0.004 285);
    --primary-foreground: oklch(0.21 0.012 285);

    --brand:                 oklch(0.7 0.19 40);
    --brand-foreground:      oklch(0.21 0.012 285);
    --brand-text:            oklch(0.8 0.14 45);
    --brand-soft:            oklch(0.29 0.05 40);
    --brand-soft-foreground: oklch(0.83 0.11 45);

    --success: oklch(0.62 0.14 150);
    --warning: oklch(0.7 0.13 70);
    --info:    oklch(0.62 0.15 255);
    --destructive: oklch(0.65 0.2 25);
}
```

**Two hard rules carried over from the product, both non-negotiable:**

1. **Never put white text on `--brand`.** Flame orange at that lightness fails
   WCAG AA against white. Use `--brand-foreground` (ink) on an orange fill, or
   `--brand-text` when the orange itself is the text.
2. **Orange is an accent, not a surface.** It appears in the mark, in one hero
   gradient, on hover/focus rings, on the geometric artwork, and on at most one
   primary button per viewport. If a section looks orange, it's wrong.

The product's admin sidebar is **dark in both themes**. Echo that: the site's
footer, code blocks and the AI section can sit on the ink neutral regardless of
theme, which gives the page rhythm without a second palette.

### Geometry — the honeycomb motif

The product's logo mark is a **hexagon** (the wordmark is "Ortha CMS"), and the
Agents view already ships a honeycomb backdrop. Make the hexagon the site's
entire geometric language — this is a real brand asset, not decoration invented
for the page.

Use it as:
- A **hex-grid backdrop** behind the hero, rendered as inline SVG with a radial
  mask so it fades to nothing at the edges. Cells fill from a low-opacity brand
  tint; a handful animate their fill on a long, staggered, offset cycle so the
  grid breathes rather than blinks.
- **Hexagonal feature icons** — a lucide icon inside a hexagon clipped with
  `clip-path`, tinted per feature with the `--nav-*` accents.
- A **hex-clipped diagram node** in the architecture illustration.
- The **404 page**: a single large hexagon with a piece missing.
- Supporting shapes, used sparingly: thin concentric arcs behind the AI section,
  a dot-grid under code blocks, and one long diagonal hairline connecting the
  hero to the first feature band.

Everything geometric is **inline SVG or CSS** — no image files, no canvas, no
WebGL. It must cost nothing on the performance budget and must render correctly
in both themes by referencing `currentColor` or the CSS custom properties.

### Typography

The product deliberately ships no custom font (system stack, dense admin scale).
The marketing site should not — a landing page needs a display scale the admin
UI never had. Self-host, subset, and preload:

- **Display/headings:** a geometric or neo-grotesque sans with tight negative
  tracking at large sizes. Recommended: **Inter Display** or **Geist**. Weights
  600 and 700 only.
- **Body:** the same family at 400/500, ~17px base, line-height 1.65,
  `text-wrap: pretty` on paragraphs and `text-wrap: balance` on headings.
- **Code:** **JetBrains Mono** or **Geist Mono**, 400 only.

Type scale (fluid, `clamp()`): hero 3.5–5rem / section H2 2–2.75rem / H3
1.25–1.5rem / body 1.0625rem / small 0.875rem. Tracking `-0.03em` on the hero,
`-0.02em` on H2, normal below.

Match the product's radii: cards `12px` (`rounded-xl`), controls `8px`
(`rounded-lg`), pills fully round. Keep the product's flat, border-led
elevation — hairline borders and near-invisible shadows, never drop shadows.

### Motion

Motion should feel engineered, not playful. Nothing bounces. Nothing spins.

- Section reveals: `opacity 0→1` plus `translateY(12px→0)` over 500ms with
  `cubic-bezier(0.16, 1, 0.3, 1)`, triggered by `IntersectionObserver`, staggered
  60ms across siblings, **fired once** and never on scroll-back.
- Hover: 140ms. Focus rings appear instantly, never animated.
- The hero honeycomb: an 8–12 second cycle, opacity only, no transform, so it
  never triggers layout.
- One **scroll-driven** moment maximum — the architecture diagram assembling as
  it enters the viewport — implemented with the CSS `animation-timeline: view()`
  where supported, and simply rendered complete where not.
- The AI section may show a **typewriter transcript** that types a prompt, shows
  a tool-step line resolving, then a change card. Loop it once, then leave it
  settled. Do not loop forever — a permanently animating element is the fastest
  way to make a page feel like a demo rather than a product.
- **`@media (prefers-reduced-motion: reduce)` must disable every one of these**,
  leaving all content visible in its final state. This is not optional; test it.

Prefer CSS animations and the Web Animations API. **Do not ship a motion
library** — it would blow the 30 KB budget on its own.

---

## 6. Page structure

One long, well-paced homepage plus four supporting pages. Build the homepage
first and completely.

### Homepage, in order

1. **Nav.** Sticky, translucent with `backdrop-filter`, becoming bordered on
   scroll. Wordmark + hexagon mark, links (Features, AI, Self-hosting, Docs,
   GitHub), a theme toggle, and a GitHub star count if it can be fetched at build
   time — never at runtime.

2. **Hero.** Honeycomb backdrop. An eyebrow pill reading "MIT licensed ·
   Self-hosted · v0.2.2". An H1 stating the promise in under 12 words. A
   subheading of one sentence naming the mechanism. Two CTAs: primary "Get
   started" (ink fill) → `/self-hosting`, secondary "View on GitHub" (outline).
   Below them, a single copyable command line:
   `git clone https://github.com/ortha-source/ortha-cms` with a copy button.

3. **The product shot.** A large, bordered, slightly perspective-tilted
   screenshot of the Content Library or entry editor, in a browser chrome frame,
   with a soft brand-tinted glow beneath. This is the single most important
   element on the page for the content-lead audience. It must be crisp — 2×
   density, and never scaled up.

4. **Trust bar.** Not fake logos. Instead: four honest figures rendered as stat
   tiles — `MIT` license · `37` npm packages · `1` runtime dependency
   (PostgreSQL) · `3` delivery protocols (REST, GraphQL, MCP).

5. **The wedge section — "AI agents are clients, not features".** The most
   distinctive block on the page and the one that should carry the most design
   investment. Dark ink surface. Left: the three proof points from §3. Right: the
   typewriter transcript showing a prompt → a tool-step disclosure line → a
   change card reading "Saved". Beneath, a row of runtime logos rendered as text
   chips: Ollama · vLLM · llama.cpp · LM Studio · LiteLLM · OpenRouter · Azure ·
   Anthropic · OpenAI, under the line "one `baseUrl`, any of these — or none at
   all."

6. **Feature grid.** Eight to ten cards with hexagonal icons, an asymmetric
   bento layout (two wide cards for Content modeling and Ortha AI, the rest
   standard). Each card: a title, one sentence, and one concrete detail. Draw
   from §2 — content modeling, the editor and publish gate, version history, rich
   text, media, localization, workspaces and RBAC, the delivery APIs, Insights,
   the audit trail.

7. **Code-first content modeling.** A two-column block: a syntax-highlighted
   `collection('post', {…})` definition on the left, the resulting Postgres table
   and the resulting API response on the right, in tabs. This is the "oh, I get
   it" moment for the primary audience. Highlight statically at build time —
   never ship a highlighter to the browser.

8. **Delivery protocols.** Three tabs — REST / GraphQL / MCP — each showing a
   real request and its response. Tabs must be real anchors with `aria-controls`
   so all three panels' content exists in the HTML for indexing.

9. **Screenshot gallery.** Four to six shots with captions, in a horizontally
   scrollable rail on mobile and a staggered grid on desktop. See §7.

10. **Self-hosting.** The five commands from §2, as a numbered list with a copy
    button on each. Beside them, the honest requirements list: PostgreSQL 16,
    Node 20.12+, Docker optional. Then a short, plain statement about what
    self-hosted means here: your database, your files, your model, no telemetry,
    no license server, no seat count.

11. **Architecture.** The plugin-host diagram — a host box, a ring of plugin
    hexagons, arrows into Postgres — assembling on scroll. One paragraph, then a
    link to `/architecture`.

12. **FAQ.** 8–10 questions with `FAQPage` JSON-LD, in a native
    `<details>`/`<summary>` accordion so it works with zero JavaScript.

13. **Final CTA.** Full-bleed ink panel, honeycomb echo, the clone command
    repeated, two buttons.

14. **Footer.** Four columns, the license line, a link to the repo, and the
    honest version marker.

### Supporting pages

- `/features` — the long-form feature breakdown, each area a section with its own
  anchor. The keyword-density workhorse.
- `/ai` — Ortha AI, MCP, local models, and the safety model in full. The page
  aimed at `MCP server CMS` and `headless CMS with local LLM`.
- `/self-hosting` — install, environment variables grouped by purpose, migrations,
  production notes, and the honest operational caveats from §12.
- `/architecture` — plugin hosts, slots, DI ports, the data layer, why content
  compiles to real tables.

Do **not** build a blog, docs, changelog, or pricing page in v1. Pricing in
particular is an anti-pattern here: the product is MIT and free, and a pricing
page implies a paid tier that does not exist.

---

## 7. Screenshots

Screenshots are the highest-value asset on the site and the hardest to fake.
Capture them from the real application.

### How to capture them (verified path)

The product repo ships a Playwright e2e harness at `apps/admin-e2e` that **mocks
`/api` at the network layer** — so the admin runs with no backend, no database
and no Docker. That is the cheapest reliable way to get real UI screenshots.

1. In a clone of `ortha-source/ortha-cms`: `npm install`.
2. Add a capture spec under `apps/admin-e2e/src/` that imports `test` from
   `./support/fixtures` (never from `@playwright/test` directly — the fixtures
   supply the Page Objects and the API mock layer). Page Objects already exist
   for: Login, Home, Workspaces, WorkspaceSettings, CreateWorkspace, Members,
   UserDetail, ActivityLog, **ContentLibrary**, RelationsEditor, **MediaLibrary**,
   MediaField, **WysiwygField**, **Agents**, **CopilotDock**, CopilotSkills and
   **Insights**.
3. Set `viewport: { width: 1600, height: 1000 }` and
   `deviceScaleFactor: 2`. Capture in **both** themes by toggling the
   `ortha.theme` localStorage key (`'light'` / `'dark'`) before load.
4. `await page.screenshot({ path: … })` per target. Run with
   `npx nx e2e admin-e2e`.
5. Convert to AVIF + WebP with a PNG fallback, and export at 1× and 2×.

### Shots to capture, in priority order

1. **Content Library / records table** — the hero shot. Filters visible,
   relation cells populated, a mix of Published / Draft / Modified statuses.
2. **Entry editor** with the Properties panel open and the publish gate visible.
3. **Agents view** — the full-page AI surface with the thread rail, a transcript
   containing a tool-step line and a change card.
4. **Copilot docked panel** over the records table — this shows the non-modal
   claim better than any sentence can.
5. **Media Library** — folder tree and asset grid.
6. **Insights dashboard** — the widget grid with charts.
7. **Rich text editor** expanded in the work area.
8. **⌘K command palette** open.

Frame each in a minimal browser chrome (a bar, three dots, a URL pill) drawn in
CSS — not baked into the image — so it re-themes with the page.

If capture proves impossible, **do not ship illustrated fakes of the UI.** Use
the code samples and diagrams instead, and leave the screenshot slots out. A
fabricated product shot is worse than no product shot.

---

## 8. Technical specification

### Stack

- **Astro 5** with `output: 'static'`. Chosen because it ships zero JavaScript by
  default, which is the dominant factor in the Core Web Vitals budget.
- **Tailwind CSS v4** via `@tailwindcss/vite`, configured **CSS-first** with
  `@theme` — no `tailwind.config.js`. This mirrors the product exactly, so the
  tokens in §5 drop in unchanged.
- **TypeScript**, strict.
- **lucide** icons, imported individually as inline SVG at build time — never as
  a runtime component library.
- **Sharp** via `astro:assets` for image optimization.
- `@astrojs/sitemap`.
- **No React, no motion library, no analytics SDK, no font CDN, no icon CDN.**

Islands are permitted for exactly four things: the theme toggle, the copy
buttons, the protocol tabs, and the hero honeycomb animation. Everything else is
static HTML. Use `client:idle` or `client:visible`, never `client:load`.

### Structure

```
src/
  components/
    layout/      Nav, Footer, ThemeToggle
    sections/    Hero, ProductShot, TrustBar, AiWedge, FeatureGrid,
                 CodeFirst, Protocols, Gallery, SelfHosting,
                 Architecture, Faq, FinalCta
    ui/          Button, Card, Badge, CodeBlock, CopyButton, Tabs,
                 StatTile, BrowserFrame
    geometry/    HexGrid, HexIcon, ArcField, DotGrid, ArchitectureDiagram
  content/       features.ts, faq.ts, protocols.ts   ← copy lives in data, not JSX
  layouts/       Base.astro (meta, JSON-LD, theme no-flash script)
  pages/         index.astro, features, ai, self-hosting, architecture, 404
  styles/        theme.css (the §5 tokens), global.css
public/
  images/screenshots/   avif + webp + png, 1× and 2×
  fonts/                self-hosted, subset woff2
```

Keep all copy in `src/content/*.ts` as typed data. It makes the page a rendering
concern and the messaging an editable one — and it means a copy revision never
risks a layout regression.

### Theming

Support light, dark and system in three states, exactly as the product does.
Define the full light palette on bare `:root`; redefine only the changed tokens
under `@media (prefers-color-scheme: dark)` guarded as
`:root:not([data-theme='light'])`; redefine them again under
`:root[data-theme='dark']` so an explicit toggle wins in both directions. Ship an
inline no-flash script in `<head>` reading `localStorage` before first paint —
the product uses the key `ortha.theme`; use the same one.

### Accessibility — hard requirements

The product holds itself to WCAG 2.1 AA. A marketing site that doesn't would be
an embarrassing tell.

- All text ≥ 4.5:1; large text and UI boundaries ≥ 3:1. **Verify the orange
  against every surface it lands on** — this is where it will fail.
- Visible focus on every interactive element. A skip link to `<main>`.
- Full keyboard operation of the nav, tabs, accordion, theme toggle and gallery.
- Tabs implement the ARIA tabs pattern with arrow-key navigation.
- No information conveyed by color alone.
- `prefers-reduced-motion` honored everywhere.
- Test with axe and fix everything it reports. Zero violations is the bar.

---

## 9. Copy direction

Write the copy yourself from §2 — do not ask for it. Guidance:

- **The H1 must survive being read alone.** Aim at: the CMS your agents can use
  and your team owns. Avoid "AI-powered" — it's the phrase every competitor is
  using this year, and it signals bolt-on.
- **Lead every feature with the verb the user cares about**, not the noun the
  engineer built. "Model content in code" beats "Code-first content modeling".
- **One concrete number per section, minimum.** The material in §2 is dense with
  them; use it. Numbers are what separate this page from every other CMS page.
- **Never describe a roadmap item in the present tense.** See §12.
- Alt text is copy. Write it as a real description of the screen.
- The FAQ answers questions honestly, including the uncomfortable ones ("Is this
  production ready?"). An honest answer converts a technical evaluator better
  than a dodge, and dodging is transparent to this audience.

---

## 10. Deployment

The site must be self-hostable, matching the product's own posture.

- `npm run build` → a static `dist/` deployable to any static host.
- Ship a `Dockerfile` (nginx serving `dist/`) and a `docker-compose.yml`, plus a
  sample Caddyfile — the audience will notice, and the product repo itself has no
  Dockerfile, so this is a chance to lead by example.
- No runtime environment variables. No server. No database.
- Security headers via `_headers` and the nginx config: a strict CSP with no
  `unsafe-inline` (hash the no-flash script), `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, HSTS.
- **No third-party analytics, no cookie banner, no tracking pixels, no external
  fonts.** For a privacy-and-control-positioned product, a Google Analytics tag
  is a contradiction the audience will spot. If analytics are needed, use a
  self-hosted Plausible or Umami and say so in the footer.

---

## 11. Acceptance criteria

The build is done when all of these are true:

- [ ] Lighthouse ≥ 98 on all four categories, mobile profile, homepage and every
      supporting page.
- [ ] Homepage ships < 30 KB of gzipped JavaScript.
- [ ] LCP < 1.2s on simulated 4G; CLS < 0.05.
- [ ] axe reports zero violations on every page, in both themes.
- [ ] Every interactive element reachable and operable by keyboard, with visible
      focus.
- [ ] `prefers-reduced-motion: reduce` leaves the page fully readable and static.
- [ ] Light, dark and system themes all correct; no flash of the wrong theme.
- [ ] Renders correctly at 320px, 768px, 1280px and 1920px. The body never
      scrolls horizontally; wide content scrolls inside its own container.
- [ ] `sitemap.xml`, `robots.txt`, canonicals, OG images and JSON-LD all present
      and valid (check with Google's Rich Results Test).
- [ ] Every product claim on the site is traceable to §2.
- [ ] Nothing from §12 is claimed.
- [ ] Builds clean with zero TypeScript errors and zero console warnings.

---

## 12. Honesty constraints — do not claim any of this

Ortha is at **v0.2.2**. The site should read as a confident early-stage
open-source project, not a mature platform. Overclaiming here would be caught
immediately by exactly the audience being targeted, and would cost more trust
than it buys.

**Not built — never state or imply these exist:**

- Email / SMTP of any kind. Invite links are copied by hand today.
- Per-workspace roles or a workspace owner. There is one *global* role per user.
- Rate limiting on the public REST or GraphQL APIs (only login is throttled).
- Signed or public media URLs — media URLs from public reads still need a
  session, so a plain `<img src>` won't load one.
- A working S3 adapter. It is a stub; every method throws.
- GraphQL subscriptions, or typed filter inputs.
- Delivery analytics — API reads, popular entries, error rates. Nothing records a
  public-API request today.
- A Docker image for the application itself. The repo ships Docker Compose for
  **Postgres only**, and no Dockerfile.
- A health or readiness endpoint, or a graceful shutdown hook.
- The copilot as an **MCP client** of your systems. Ortha is an MCP *server*.
  These are opposite directions.
- Copilot delete tools, or any copilot publish capability at any role.
- A run surviving a closed tab or a page reload.
- Backup/restore tooling, observability, or a deploy pipeline.
- A hosted or cloud offering, a paid tier, an enterprise edition, or support SLAs.
- Any customer, user count, testimonial, case study, uptime figure, benchmark
  against a competitor, or security certification.

**State plainly where asked (in the FAQ or `/self-hosting`):**

- The copilot's permission broker is **in-memory**, so a run and its permission
  decision must reach the same instance. That is correct for the single-node
  self-hosted deployment this targets; horizontal scaling needs sticky routing by
  run ID. Say so — an operator who discovers it later trusts you less than one who
  reads it up front.
- It is early. "v0.2.2, MIT, and moving quickly" is a fine thing to say. "Battle-
  tested at scale" is not.

**Two documents in the product repo are stale and must not be used as sources:**
`ARCHITECTURE.md` §8 ("What does not exist yet") and one line in the
`CONTEXT-MAP.md` glossary both claim there is no content model and no LLM
integration. Both shipped. §2 of this brief supersedes them.

---

## 13. Brand assets you must create

The product repo contains **no logo files, no SVGs and no wordmark** — only a
`favicon.ico`. The mark is generated in code: a **hexagon** in an ink-filled
rounded badge, beside the wordmark "Ortha CMS" set at medium weight.

Produce, as part of this build:
- An SVG logomark (hexagon) and a lockup (mark + wordmark), each in single-color
  light and dark variants.
- A favicon set: SVG, 32×32 and 180×180 PNG, plus `site.webmanifest`.
- A 1200×630 OG image per page, generated at build from a shared template —
  ink background, honeycomb echo, page title, wordmark.

Keep the hexagon geometrically exact — a regular hexagon, flat-top, consistent
stroke weight. It appears at 24px in the nav and at 400px in the hero; it must
hold at both.

---

## 14. Order of work

1. Scaffold Astro + Tailwind v4, drop in the §5 tokens, build `Base.astro` with
   meta and the no-flash theme script.
2. Build the logo, favicons and the `HexGrid` component. Get the hero right
   before anything else — it sets the entire visual register.
3. Nav, Footer, and the `ui/` primitives.
4. Homepage sections in the §6 order, with copy from `src/content/*.ts`.
5. Capture screenshots (§7) and wire the gallery and product shot.
6. The four supporting pages.
7. JSON-LD, sitemap, OG image generation, `robots.txt`.
8. Accessibility and performance passes against §11 until every box is checked.
9. Dockerfile, compose file, headers, README.

Build the homepage completely — including copy, screenshots and animation —
before starting the supporting pages. A finished homepage is shippable on its
own; five half-finished pages are not.
