# Ortha CMS — Marketing Website Build Prompt

> **What this document is.** A single, self-contained brief you can hand to a
> build agent, an agency, or a contractor to produce the Ortha CMS marketing
> website. It contains the product truth (verified against the codebase on this
> branch), the positioning, the full feature inventory with marketing-ready
> copy angles, the SEO strategy, the page-by-page information architecture, and
> the accuracy guardrails.
>
> **How to use it.** Paste §0 as the system/role framing, then the sections the
> task needs. §1–§5 are _what is true_. §6–§9 are _what to say_. §10–§13 are
> _what to build_. §14 is _what not to claim_ — that section is
> non-negotiable and must travel with every excerpt. **Appendix A** is the
> product's design-token block, copy-pasteable; hand it to whoever builds the
> site alongside §10.
>
> **Source of truth.** Everything in §3–§5 is derived from the repository's own
> documentation (`ARCHITECTURE.md`, `CONTEXT-MAP.md`, `docs/adr/`,
> `docs/design/copilot.md`, and each package's `AGENTS.md`). §10 and Appendix A
> are lifted from `apps/admin/src/styles.css`,
> `packages/design-system/src/styles.css`, and the component sources under
> `packages/design-system/src/lib/components/ui/`. If the code and this document
> disagree, the code wins — re-verify before publishing.

---

## 0. The prompt framing

> You are a senior product marketer, SEO strategist, and front-end engineer
> building the marketing website for **Ortha CMS**, an open-source, self-hosted,
> plugin-based headless CMS with a built-in, model-agnostic AI copilot and a
> native Model Context Protocol (MCP) server.
>
> Your audience is **technical**: staff and senior engineers, engineering
> managers, platform teams, and technically-literate content operations leads.
> They evaluate tools by reading the docs and the source, not by reading
> adjectives. Every claim on this site must be checkable within two clicks.
>
> Your job is to convert that audience to one of three actions: **read the
> quickstart**, **star the repo**, or **self-host in under ten minutes**. Not
> "book a demo". Not "talk to sales".
>
> Write like a good engineering blog, not like a SaaS landing page. Show code.
> Show real screenshots. Name the trade-offs. Say what the product does _not_
> do. Credibility is the conversion mechanism for this audience — every
> unearned superlative costs more trust than it buys attention.

---

## 1. What Ortha CMS is, in one paragraph

Ortha CMS is an open-source (MIT), self-hosted headless CMS built as a small
plugin **host** plus a list of **plugins**. Content types are defined in
TypeScript and compiled into real PostgreSQL tables with generated, committed
migrations — not stored as JSON blobs in a generic table. It ships a React 19
admin with versioning, localization, media, rich text, RBAC, workspaces and an
append-only audit trail; a token-authenticated public content API; a native MCP
endpoint so external AI agents can work with content; and **Ortha AI**, an
in-admin copilot that runs on whatever model the operator points it at —
including a local one — and that proposes changes for a human to accept rather
than writing silently.

**The one-line version:** _The headless CMS your team and your agents can both
use safely._

---

## 2. Positioning

### 2.1 The category

Headless CMS / content infrastructure. Direct competitive set: **Payload**,
**Strapi**, **Directus**, **Keystone** (self-hosted open source);
**Contentful**, **Sanity**, **Storyblok**, **Hygraph** (hosted SaaS).

### 2.2 The wedge

Three things are simultaneously true of Ortha and of almost nothing else in the
category. The site's entire narrative hangs off these.

1. **Schema is code; storage is real Postgres.** A content type is a TypeScript
   declaration that becomes an actual table with actual columns, actual foreign
   keys, actual indexes, and a generated migration you commit and review. Your
   content model lives in git and moves through your CI like the rest of your
   application. There is no admin-built schema drifting between environments,
   and no `content` table with a `data jsonb` column that your DBA can't query.

2. **AI is a first-class, governed capability — not a bolt-on "generate" button.**
   Ortha AI has no identity of its own. It executes as the signed-in user, with
   that user's permissions, recomputed per run. Writes produce **proposals** a
   human accepts; direct application is a per-workspace, per-tool opt-in an
   admin makes deliberately. Publishing is not exposed to the model at any role.
   Every tool call is audited. And the model provider is a swappable port — the
   whole thing runs against a local Ollama or vLLM endpoint with no content
   leaving your network.

3. **The CMS is an MCP server.** Claude Desktop, Cursor, or an SDK-built agent
   connects to one endpoint with a scoped bearer token and gets described,
   permission-filtered content CRUD. Not a REST API an agent has to be taught —
   a described capability surface it can discover.

### 2.3 Positioning statement

> For engineering teams who own their content platform, Ortha CMS is a
> self-hosted headless CMS that treats your content model as code and your AI
> agents as first-class, permission-bound users. Unlike hosted CMSs that own
> your data or open-source CMSs that bolt AI on as a text-generation widget,
> Ortha makes both the human and the agent path go through the same validated,
> audited, revision-backed write path.

### 2.4 Audience segments and their jobs

| Segment                              | Who they are                                                   | The job they're hiring Ortha for                                    | The line that lands                                                       |
| ------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Platform / staff engineer**        | Owns the content platform for several front-ends               | "Give me a content model I can review in a PR and migrate in CI"    | Schema in TypeScript, migrations in git                                   |
| **Agency / consultancy tech lead**   | Ships client sites, needs multi-tenancy                        | "One deployment, many clients, hard isolation"                      | Workspaces with per-workspace content grants and scoped API tokens        |
| **AI/platform team**                 | Building internal agents                                       | "Let our agents read and edit content without giving them the keys" | MCP endpoint + scoped tokens + propose-then-apply                         |
| **Content ops lead**                 | Runs a multilingual editorial team                             | "Translations that don't drift and a history I can roll back"       | Row-per-locale with shared-field sync, per-entry version history          |
| **Compliance / public sector buyer** | Procurement with accessibility and data-residency requirements | "It must be self-hosted, auditable, and accessible"                 | Self-hosted, WCAG 2.1 AA target, append-only audit trail, local inference |

### 2.5 Competitive frames (use these exact contrasts)

- **vs. Strapi / Directus** — Their schema is built in the admin and lives in
  the database. Ortha's is TypeScript, reviewed in a PR, migrated by drizzle-kit,
  and identical in every environment because it's the same file.
- **vs. Payload** — Closest philosophical neighbour, and say so; do not
  pretend otherwise. The difference is architectural and AI-shaped: in Ortha
  _everything_ is a plugin (auth, content, media, localization, the copilot
  itself), so a capability is added or removed without touching the host — and
  the AI/agent layer is designed around an authority model, not added as a
  feature.
- **vs. Contentful / Sanity / Storyblok** — Your content sits in someone else's
  Postgres, priced per record and per API call, and your AI features run on
  their chosen model with your content sent to their vendor. Ortha is your
  Postgres, your infrastructure, your model — down to a laptop running Ollama.
- **vs. WordPress + plugins** — Different job entirely; frame as
  "if you're serving one site with themes, use WordPress; if you're serving
  many front-ends from one governed content platform, that's this".
- **vs. "just build it on Prisma/Drizzle yourself"** — The honest competitor for
  this audience. Frame the answer as: you'd end up building the admin, the
  versioning, the publish workflow, the localization row model, the media
  pipeline, the RBAC, and the audit log. Ortha is those, with the schema-as-code
  ergonomics you'd have built anyway.

---

## 3. Feature inventory — shipped and verifiable

Everything in this section is implemented in the repository. Each item carries
the _marketing angle_ to use. Depth here is deliberate: the site needs enough
substance to fill a features hub, ten spoke pages, and a year of blog posts.

### 3.1 Content modeling — schema as code

- **A TypeScript DSL.** `collection()` for multi-entry types, `single()` for
  one-off pages, and `field.*` builders: `text`, `richtext`, `number`, `money`,
  `boolean`, `date`, `datetime`, `select`, `multiselect`, `json`, `relation`,
  `media`. Fully typed, with entry types inferred from the declaration.
- **Real tables.** Each type becomes `content_<name>` with typed columns; each
  many-to-many relation becomes its own join table. Envelope columns
  (`id`, `workspace_id`, `created_at`, `updated_at`) are platform-owned.
- **Migrations you own and review.** `nx run <plugin>:db:generate` emits SQL you
  commit; `nx run server:db:migrate` applies every plugin's pending migrations.
- **All four relation cardinalities.** many-to-one, one-to-many, one-to-one
  (a unique FK), many-to-many (a join table with an explicit `position` column,
  so editorial ordering survives). Two-way relations declare an _inverse_ side
  that carries no storage of its own — so both ends read and write the same
  links and cannot drift.
- **Type-level flags that turn on whole workflows.** `publishable: true` adds
  the draft/published lifecycle; `paranoid: true` adds soft delete and a Trash
  view; `i18n: true` adds row-per-locale storage. One boolean, one behaviour.
- **Validation defined once.** The rules live in a framework-free kernel that
  _both_ the admin form and the API validate against, so the client and the
  server cannot disagree about what a valid entry is.

> **Angle:** "Your content model is a pull request." Lead the developer story
> with a real 12-line collection file, and show the generated SQL beside it.

### 3.2 The publishing workflow

- Draft → published, with `published_at` tracked separately from status.
- **Four editor states over two stored values**: _Not saved yet_, _Draft_,
  _Modified_ (live content with unpublished edits on top), _Published_. That
  third state is the one most CMSs collapse and editors get burned by.
- **Required means required-to-publish.** A draft can be incomplete and still
  save; the rules bite at publish, with the failing fields named.
- **A live publish gate** in the editor: a checklist of every requirement with
  its pass/fail state, updating as you type.
- **Bulk actions with a dry run.** Bulk publish opens a preview listing each
  selected record's verdict — will publish / already published / blocked, with
  reasons — before anything happens.

> **Angle:** "You can't accidentally publish something broken, and you can't
> accidentally _not_ publish something you thought went live."

### 3.3 Version history

- **Every save is a version.** Restore any of them, or publish any of them
  directly — publishing an older version marks that version live without
  growing the timeline by one on every click.
- **Field-level diffs.** A preview dialog compares any version against current,
  in schema order, with unchanged fields collapsed. Relation fields render the
  actual linked records and media fields the actual assets — not raw UUIDs.
- **Editing a published entry does not take it offline.** The save becomes a
  draft; the previously published version stays live until you publish again.

### 3.4 Localization

- **Row per locale**, siblings sharing a translation group id. Not a JSON bag of
  languages in one row.
- **Per-field scope.** A field is _translated_ or _shared_; shared fields sync
  across every sibling in the group automatically, and the editor groups them
  under explicit "Translated fields" / "Shared fields" headings so nobody
  discovers the rule after saving.
- **Consistency is enforced, not hoped for.** A shared-field edit re-validates
  every published sibling in the same transaction and demotes rewritten
  siblings to _Modified_ — so a draft edit can never silently invalidate a live
  translation.
- **Translation-aware filters.** Filter by `hasLocale`, `missingLocale`, or
  `localeCount` — "which articles are missing a German version?" is one filter,
  not a spreadsheet.
- **Relations cannot cross locales**, enforced in the writer (not just the UI),
  while genuinely shared targets (an author, an SEO record) stay linkable from
  every translation.
- **A stable identity across languages.** The public API addresses an entry by
  its translation group id plus a locale, so a localized front-end holds one id
  per story rather than one per language.
- **Bulk locale actions**: publish or unpublish every locale of a record.

> **Angle:** "Localization that survives contact with a real editorial team."
> This is a genuinely strong differentiator — most competitors' localization is
> either a field-level JSON map or a paid add-on.

### 3.5 The editing experience

- **A records table that does real work**: server-side search, sort, paginate;
  a recursive query builder that filters across relation paths
  (`author.company.name`); a column picker with drag-and-drop reordering; row
  selection with bulk operations; per-collection Trash views.
- **⌘K content palette** for jumping between content types.
- **A tabbed entry editor** — General, Relations, Media, History — where tabs
  are routes, so a link lands you where you were.
- **Rich text that isn't a raw HTML textarea.** A TipTap-based editor that
  expands into the record's work area (not a modal, so the publish gate and Save
  stay live beside it) with headings, colour, alignment, lists, links, callouts,
  tables, column layouts, and resizable embedded images and video.
- **Alt text prompted where the author can see the picture.** Every image
  carries its own alt control with a visible warning chip while it's missing,
  and an explicit "decorative" checkbox that distinguishes "this needs no
  description" from "nobody wrote one yet".
- **Rich text is never rendered unsanitized.** Stored HTML is round-tripped
  through the editor's own schema before display, so what a contributor pasted
  cannot become a stored XSS against an admin who opens the record.
- **Relations edited as deltas.** A record with thousands of links is never
  sent or held whole; assign, unassign and reorder stage locally and commit in
  one transaction on save.
- **Read-only means read-only.** A user without write permission gets an inert
  _form_, not just greyed-out buttons — with values still selectable and
  copyable, and a banner saying why.
- **Light / dark / system theme**, per user, persisted server-side.
- **A fully internationalized admin UI** (react-intl throughout).

### 3.6 Media

- **Folders and assets**, with a tree, drag-and-drop upload, search, type
  filters, sorting, bulk actions and an asset detail drawer.
- **Storage is a port.** Local filesystem ships; the interface is
  `put/get/remove/url`, so an S3 or any other backend is a package plus one
  line at the composition root. The chosen provider is recorded per asset, so
  changing the default never strands existing files.
- **Automatic image derivatives.** Uploads are processed into WebP thumbnails
  (≤320px) and previews (≤1280px), never upscaled, stored under a reserved key
  namespace. The library grid never loads a full-size original to draw a tile.
- **An upload queue that behaves.** Bounded concurrency, one request per file,
  per-file progress, retry on failure, cancel in flight — a failed file doesn't
  lose the batch.
- **Media fields on content types**, with `accept` restrictions by kind or MIME
  type, enforced on the server at save.
- **Uploads deferred to Save.** Files chosen on a record's media field don't
  upload until the record is saved — so an abandoned edit doesn't litter the
  library, and the record and its new assets land as one commit.
- **Folder delete cascades** the whole subtree, with the confirmation dialog
  naming exactly what will go.

### 3.7 Permissions, workspaces and audit

- **Invite-only by design.** There is no public registration; the only way into
  an account is an admin's invite.
- **RBAC** with three system roles — admin, contributor, viewer — over an
  enumerated permission catalogue (`content:publish`, `media:create`, …). Admin
  holds the enumerated set, not a wildcard, so a new permission is a deliberate
  grant.
- **Workspaces** as tenants: each with its own members, its own granted content
  types, its own media, and hard isolation enforced server-side on every route.
- **A create wizard** (Basics → Members → Content) and a full settings surface
  (general, members, content grants, danger zone), with block-before-you-act
  guards — you can't revoke a content grant or delete a workspace that still
  holds entries, and the UI tells you before the server has to refuse.
- **Sessions you can see and revoke**, per device, per user.
- **An append-only audit trail** written through a transactional outbox, keyed
  by event id so a redelivery can never double-record. Filterable by actor,
  subject, kind and date range, surfaced globally, per user, and on the home
  dashboard.
- **Security posture worth stating explicitly**: bcrypt passwords, DB-backed
  revocable sessions in httpOnly cookies with the token SHA-256-hashed at rest,
  rate-limited login, CSRF origin checks on state-changing requests, account
  status re-checked on every request, and invite links that are one-time,
  unprobeable, and identical in failure whatever went wrong.

### 3.8 The public content API

- **`/api/v1`, bearer-token authenticated.** Session cookies are deliberately
  not accepted.
- **Reads**: list and single-entry, search, the same structured filter grammar
  the admin uses, sorting, pagination, and **sparse fieldsets** that narrow the
  SQL projection as well as the response — an unselected rich-text column is
  never read off disk.
- **Opt-in expansion** of relations, media and translations, on lists and single
  entries alike, batched so the query count stays flat as the page grows
  (measured: the same number of queries at `pageSize=1` and `pageSize=50`).
- **Writes** with a `full`-scope token: create, partial update, publish,
  unpublish, delete, plus media upload — all through the same validated,
  revisioned, audited write path the admin uses.
- **Published-only by default**, with draft visibility available to write-scoped
  tokens only.
- **Grant-pruned**: a content type the workspace was never granted is
  indistinguishable from one that doesn't exist.
- **API tokens** with a workspace _bucket_ (one or many), read or full scope,
  SHA-256 at rest, plaintext revealed exactly once, revocable, with last-used
  tracking.
- **A self-documenting API.** OpenAPI is generated at boot from the live content
  registry — each content type contributes its own request/response schemas —
  and served as an interactive Scalar reference at `/reference`.

### 3.9 Ortha AI — the copilot

- **A docked, non-modal chat panel** (⌘J) that sits beside the page rather than
  over it, so you can act on an answer without closing the conversation. It
  minimizes while a run keeps streaming.
- **Model-agnostic by architecture.** A provider port with three shipped
  adapters: native Anthropic, any OpenAI-wire-compatible endpoint (Ollama,
  vLLM, llama.cpp, LM Studio, LiteLLM, OpenRouter, Azure, OpenAI), and a
  scripted deterministic provider so CI and offline development need no key and
  no network. Every registered provider × model pair appears in a **per-turn**
  model picker — start a thread cheap, escalate mid-conversation.
- **It runs on your infrastructure if you want it to.** Point one setting at a
  local runtime and no workspace content leaves your network.
- **It has no authority of its own.** Every run executes as the signed-in user.
  The capability profile is computed per run from live permissions and
  workspace membership, never cached across a thread — a revoked role bites on
  the next tool call.
- **Writes are proposals.** A write tool computes a change and hands it back; a
  human accepts it, and applying runs the ordinary use-case — same validation,
  same revision, same audit row, with the human as the actor. A prompt-injected
  "just save it" has nowhere to land.
- **Auto-apply is a deliberate, per-workspace, per-tool opt-in.** No wildcard.
  Absence reads as closed, so enabling the copilot never silently enables
  writes. An auto-applied change still writes its proposal row first — undoable,
  never invisible.
- **Publishing is not exposed to the model at any role.** The copilot can
  prepare a publishable draft; a person presses publish.
- **Its work is visible.** Every tool call renders as a step you can expand to
  the exact input and output. Every attempted call is audited, successful or
  refused.
- **Bounded three ways** — maximum steps, wall clock, and total tokens — with
  the stop reason shown.
- **Context is opt-in.** "Where you are" (workspace, content type, entry,
  locale) attaches only when you click to attach it, and the attached snapshot
  is displayed so you can correct it.
- **What it can actually do today**: search and filter content across the whole
  query surface, read entries and their revisions, diff two versions, list
  locales and find missing translations, search media, read the activity log
  (admins only) and list workspace members — and propose entry creates, entry
  updates, translations into a new locale, and image alt text.
- **Off by default.** A global kill switch, because enabling a hosted provider
  sends content to a third party and that is an operator's decision to make
  explicitly.

> **Angle:** This is the marquee section. The headline is not "AI in your CMS".
> It's **"An AI that can only do what you can do, and asks before it changes
> anything."** Lead with the authority model, not the chat bubble.

### 3.10 MCP — the CMS as an agent-native surface

- **One endpoint** (`POST /api/v1/mcp`), Streamable HTTP, stateless, so it
  scales like the rest of the API and needs no session store or sticky routing.
- **Twelve generic content tools** plus content types as MCP resources —
  `typeName` is an argument, so the tool set doesn't grow with your content
  model and doesn't blow out an agent's context on connect.
- **The same credential and the same rules** as the public API. Revoke the token
  and MCP access dies in the same instant. A `read`-scoped token never even
  sees the write tools.
- **Works with existing clients today** — Claude Desktop, Cursor, or anything
  SDK-built, via a few lines of client config.
- **Off by default**, for the same reason as the copilot.

> **Angle:** "Your CMS, in your agent's toolbox." This is the highest-leverage
> SEO opportunity on the site — see §8.2. Almost nobody in the category owns
> this term yet.

### 3.11 Architecture and developer experience

- **A plugin host, not a monolith.** `createServer({ plugins })` and
  `createAdmin({ plugins })`. Auth, content, media, localization, rich text,
  the copilot — all plugins. Adding a capability means adding a plugin and one
  registration line. You never edit the host.
- **Two extension mechanisms with no coupling**: named UI slots on the admin
  side (a plugin contributes a nav item, a table column, an editor tab, a field
  control, a sidebar widget) and DI ports on the server side (a plugin declares
  an interface; another binds it). This is how localization extends the content
  pipeline without content knowing what a locale is, and how the media plugin
  fills the rich-text editor's asset picker without the editor depending on it.
- **No build step between packages.** Workspace packages resolve from source,
  so a change in the design system is live in the admin immediately.
- **The whole stack in one terminal** — `npm run dev` runs the API in watch
  mode, its typechecker, the Vite dev server, and the admin's typechecker in
  four panes.
- **Per-plugin migrations** applied by one host command.
- **Real test coverage as a shipped artifact**: Playwright end-to-end suites for
  the admin (including axe accessibility scans and keyboard suites) and an
  in-process Postgres-testcontainer suite for the API.
- **Accessibility as a hard requirement**, targeting WCAG 2.1 AA, with the
  reasoning documented per component and pinned by automated scans.
- **The stack**: NestJS 11, React 19, Vite, TypeScript, PostgreSQL, Drizzle ORM,
  Tailwind v4, shadcn/ui, TanStack Query, Nx monorepo, npm workspaces. MIT
  licensed.

---

## 4. The honest state of things

Publish this. A public, accurate "what's not built yet" list is one of the
strongest trust signals available to an early open-source project, and it
pre-empts the disappointment that kills evaluations. Put it on `/roadmap` and
link it from the footer and from the pricing page.

**Not built yet:**

- **Email delivery.** There is no SMTP integration — invite links are copied
  from the admin and handed over manually. Say so plainly; it is the single most
  likely thing to surprise a first-time self-hoster.
- **Content export.** No CSV/JSON export tool yet.
- **Full-text or semantic search.** Search is efficient SQL matching plus the
  structured filter builder; there is no search index and no embeddings.
- **Insights / analytics.** The nav entry exists; the dashboards do not.
- **Scheduled publishing, workflow approvals, live preview, webhooks, background
  jobs, and real-time collaboration.** None of these exist today.
- **An S3 storage adapter.** The seam is built and the local provider ships; the
  S3 implementation is not finished.
- **Per-workspace roles.** Roles are global per user; workspace membership is a
  link without a role.
- **Runtime model configuration.** Copilot providers are configured through
  environment variables and the composition root, not through a settings UI.

**On the roadmap (frame as direction, never as availability):** content export,
runtime model configuration with encrypted credentials, MCP _client_ connectors
so the copilot can reach an operator's own systems, natural-language filters in
the command palette, and background/async AI work with semantic retrieval.

---

## 5. Proof points — the specific, checkable claims

Marketing for this audience runs on specifics. Use these; each is verifiable in
the repository.

| Claim                             | The specific                                                                                  |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| Content model is real SQL         | One table per type, one join table per many-relation, generated migrations you commit         |
| Validation can't drift            | One framework-free kernel validated against by both the admin form and the API                |
| Filters can't drift               | One traversal builds both the UI's field picker and the SQL whitelist, pinned by a drift test |
| Expansion doesn't N+1             | Verified flat query counts at `pageSize=1` and `pageSize=50`                                  |
| Sparse fieldsets are real         | The SQL projection narrows too — an unselected rich-text column is never read                 |
| The agent path can't diverge      | MCP tool handlers call the same services the HTTP controllers call                            |
| The AI can't exceed its user      | Capability profile recomputed per run; permissions re-checked per tool call                   |
| The AI can't publish              | No publish tool is exposed at any role                                                        |
| The AI leaves a trail             | Every attempted tool call is audited, refusals included                                       |
| Audit can't be lost or doubled    | Written through a transactional outbox, keyed by event id, `ON CONFLICT DO NOTHING`           |
| Concurrency is handled, not hoped | Per-entry advisory locks for revision numbering, workspace locks for delete-vs-create races   |
| Accessibility is tested           | axe scans and keyboard suites in the end-to-end pack                                          |
| It runs offline                   | A shipped scripted model provider means CI and a fresh clone need no key and no network       |

---

## 6. Messaging

### 6.1 Headline candidates

Test these; the first two are the strongest.

1. **The headless CMS your team and your agents can both use safely.**
2. **Your content model is a pull request.**
3. Self-hosted, schema-as-code, AI-native. Pick all three.
4. A CMS that gives AI exactly as much authority as the person using it.
5. Content infrastructure you own — down to the model.

### 6.2 Sub-headline

> Open-source, self-hosted, plugin-based. Define content types in TypeScript and
> get real Postgres tables, versioning, localization, media, RBAC and an audit
> trail — plus an AI copilot and an MCP endpoint that operate under the same
> permissions your people do.

### 6.3 The five value propositions (these become the home page's five sections)

1. **Schema as code.** Define it in TypeScript, review it in a PR, migrate it in
   CI. Identical in every environment because it's the same file.
2. **AI with an authority model.** No service account, no elevated identity, no
   silent writes, no publish. Runs on your model — including a local one.
3. **Agent-ready by protocol.** A native MCP endpoint with described,
   permission-filtered tools, on the same tokens and the same rules as your API.
4. **Editorial workflows that hold up.** Versioning with real diffs,
   localization that doesn't drift, publish gates that name what's blocking, an
   audit trail that can't be lost.
5. **Everything is a plugin.** Add or remove a capability without touching the
   host. Extend the admin through slots and the server through ports.

### 6.4 Tone of voice

- **Precise over enthusiastic.** "Batched to a flat query count" beats
  "blazing fast".
- **Concrete over abstract.** Show the code. Show the SQL. Show the screenshot.
- **Trade-off-honest.** Name what Ortha isn't good for. A sentence conceding a
  competitor's strength buys more credibility than a page of superlatives.
- **No hype vocabulary.** Ban: revolutionary, game-changing, seamless,
  effortless, next-generation, cutting-edge, unlock, supercharge, 10x,
  "the future of".
- **No fabricated social proof.** No fake logos, no invented testimonials, no
  made-up user counts, no "trusted by thousands". If there's nothing to show,
  show GitHub activity and the docs instead.
- **Second person, active voice, short sentences.** Technical readers skim; make
  the first sentence of every section carry the whole point.

---

## 7. SEO strategy

### 7.1 The strategic read

Ortha is a new entrant in a category where the head terms ("headless CMS",
"open source CMS") are owned by well-funded incumbents with years of domain
authority. Competing there directly is a multi-year, losing play at launch.

**So the SEO strategy is three-layered:**

- **Layer 1 — Own the uncontested.** "MCP CMS", "CMS for AI agents",
  "self-hosted AI CMS", "local LLM CMS". These have low volume _today_ and are
  growing fast. Being the definitive result before the volume arrives is the
  single highest-ROI move available. Build these pages first.
- **Layer 2 — Win the comparison and long-tail.** "Strapi alternative",
  "Payload CMS alternative", "headless CMS with content versioning",
  "multi-tenant headless CMS". High intent, achievable, and directly
  conversion-adjacent.
- **Layer 3 — Chip at the head.** "Headless CMS", "self-hosted CMS",
  "TypeScript CMS". Target these with the pillar pages and expect 12–18 months.
  Never sacrifice layers 1 and 2 for these.

### 7.2 Keyword clusters

**Cluster A — Agent & AI (own this; build first)**
`mcp cms` · `model context protocol cms` · `cms for ai agents` · `ai headless cms` ·
`self-hosted ai cms` · `local llm cms` · `ollama cms` · `connect claude to cms` ·
`give ai access to content safely` · `ai content management prompt injection` ·
`mcp server for content` · `claude desktop cms integration` · `agent-ready cms`

**Cluster B — Comparison & alternatives (high intent)**
`strapi alternative` · `payload cms alternative` · `directus alternative` ·
`contentful alternative open source` · `sanity alternative self-hosted` ·
`strapi vs payload` · `open source contentful alternative` · `keystone js alternative` ·
`best self-hosted headless cms 2026`

**Cluster C — Developer stack (qualified traffic)**
`typescript headless cms` · `nestjs cms` · `drizzle orm cms` · `postgres headless cms` ·
`react admin cms` · `nx monorepo cms` · `code first content modeling` ·
`schema as code cms` · `headless cms with migrations`

**Cluster D — Capability long-tail (easiest wins, most pages)**
`headless cms content versioning` · `headless cms localization` ·
`headless cms rbac` · `multi-tenant headless cms` · `headless cms audit log` ·
`headless cms soft delete` · `headless cms draft preview` ·
`wcag compliant cms admin` · `accessible cms` · `headless cms media library` ·
`headless cms relations many to many` · `cms api sparse fieldsets`

**Cluster E — Integration & how-to (top-of-funnel volume)**
`next.js headless cms` · `astro cms` · `nuxt headless cms` · `sveltekit cms` ·
`remix cms` · `headless cms tutorial` · `self-host cms docker` ·
`headless cms deploy` · `headless cms for multilingual site`

**Cluster F — Buyer/compliance (low volume, high value)**
`gdpr compliant cms` · `data residency cms` · `cms for public sector` ·
`open source cms for government` · `self-hosted cms compliance`

### 7.3 Answer-engine optimization (AEO/GEO)

Increasingly, this audience asks an LLM before it asks Google — and Ortha's own
audience is disproportionately likely to. Optimize for citation:

- **Lead every page with a direct answer.** A 40–60 word paragraph immediately
  under the H1 that answers the page's question outright. This is the block an
  answer engine extracts.
- **Use comparison tables with explicit competitor names.** Tables are extracted
  cleanly and cited. Be scrupulously fair — a table that misrepresents a
  competitor gets corrected publicly and costs more than it gains.
- **Ship an FAQ block on every commercial page**, marked up as `FAQPage`.
- **Publish `/llms.txt`** at the root: a plain-text map of the product, its
  capabilities, its limitations, and links to the canonical docs pages. Cheap to
  produce, increasingly consumed, and thematically perfect for an AI-native CMS.
- **Keep facts in text, not in images.** Screenshots need real text captions
  and alt text carrying the claim.

### 7.4 Technical SEO requirements

- **Static generation.** Astro or Next.js in SSG/ISR mode. Content pages must be
  server-rendered HTML; do not ship a client-rendered SPA marketing site.
- **Core Web Vitals budget**: LCP < 1.8s on 4G, CLS < 0.05, INP < 200ms.
  JS budget ≤ 100KB gzipped on content pages. Self-host and subset fonts.
  AVIF/WebP with explicit dimensions on every image.
- **Docs live at `/docs`, not `docs.ortha.dev`.** Consolidate authority on one
  domain; a docs subdomain splits it and this project cannot afford that.
  The blog lives at `/blog` for the same reason.
- **One canonical URL per page**, lowercase, hyphenated, no trailing slash
  inconsistency, no parameters in indexable URLs.
- **Structured data**: `SoftwareApplication` (home), `Organization` (global),
  `BreadcrumbList` (everywhere), `FAQPage` (commercial pages),
  `Article` + `author` (blog), `HowTo` (tutorials), `TechArticle` (docs).
- **Semantic HTML with a single H1 per page** and a genuine heading hierarchy —
  which also serves the accessibility story the product itself sells.
- **`sitemap.xml`** (segmented: pages, docs, blog), **`robots.txt`**,
  **`/llms.txt`**, RSS for the blog and the changelog.
- **Open Graph and Twitter cards** on every page, with templated, per-page OG
  images generated at build time.
- **Internal linking**: every spoke links up to its pillar and laterally to two
  siblings; every comparison page links to the relevant feature spokes; every
  docs page links to the feature page it documents and vice versa.
- **Analytics**: privacy-respecting and cookieless (Plausible or Umami) — using
  a tracker that requires a consent banner would contradict the product's own
  data-sovereignty pitch. This is a positioning decision as much as a technical
  one.

### 7.5 Title and meta patterns

```
Home        Ortha CMS — Self-Hosted Headless CMS with AI and MCP Built In
Feature     <Feature> — Ortha CMS
Comparison  Ortha CMS vs <Competitor>: An Honest Comparison
Solution    <Use case> with Ortha CMS
Docs page   <Topic> — Ortha CMS Docs
Blog        <Title> — Ortha CMS Blog
```

Meta descriptions: 140–158 characters, lead with the concrete benefit, end with
a verb. Never duplicate across pages. Never auto-generate from body text.

---

## 8. Information architecture

### 8.1 Site map

```
/                              Home
/features                      Features hub
  /features/content-modeling   Schema as code, relations, migrations
  /features/publishing         Draft/publish, versioning, publish gates
  /features/localization       Row-per-locale, shared fields, translation groups
  /features/media              Library, derivatives, storage providers
  /features/editor             Records table, rich text, query builder
  /features/api                Public content API, tokens, OpenAPI
  /features/permissions        RBAC, workspaces, audit trail, security
  /features/plugins            The plugin host, slots and ports
  /features/accessibility      WCAG 2.1 AA, keyboard, screen readers
/ai                            PILLAR — Ortha AI (the copilot)
  /ai/authority-model          How the copilot is bounded (the trust page)
  /ai/self-hosted-models       Ollama, vLLM, and running inference locally
/mcp                           PILLAR — the CMS as an MCP server
  /mcp/claude-desktop          Setup guide (also a docs page; canonical here)
  /mcp/cursor                  Setup guide
/developers                    Developer hub
  /developers/quickstart       Ten-minute self-host
  /developers/architecture     The plugin host explained
  /developers/self-hosting     Docker, Postgres, environment, deployment
/compare                       Comparison hub
  /compare/strapi
  /compare/payload
  /compare/directus
  /compare/contentful
  /compare/sanity
/solutions
  /solutions/multi-brand       Workspaces as tenants
  /solutions/multilingual      The localization story
  /solutions/agencies          One deployment, many clients
  /solutions/regulated         Self-hosted, auditable, accessible
/integrations                  Next.js, Astro, Nuxt, SvelteKit, Remix
/pricing                       Free and open source; what's paid, if anything
/roadmap                       Shipped / building / considering — and §4's honest list
/security                      Security posture, disclosure policy
/changelog                     Release notes, RSS
/blog                          Content marketing
/docs                          Documentation (own domain path, not a subdomain)
/about
/legal/{privacy,terms,license}
```

### 8.2 Build priority

Ship in this order. Do not build all of it before launching.

- **Phase 1 (launch):** `/`, `/features` hub, `/ai`, `/mcp`, `/developers/quickstart`,
  `/docs` (at least: install, first content type, first API call, MCP setup),
  `/pricing`, `/roadmap`, `/blog` with three posts.
- **Phase 2 (weeks 2–6):** the nine feature spokes, `/compare/strapi`,
  `/compare/payload`, `/ai/authority-model`, `/security`, `/changelog`.
- **Phase 3 (months 2–4):** remaining comparisons, `/solutions/*`,
  `/integrations/*`, `/mcp/*` guides, sustained blog cadence.

---

## 9. Page briefs

### 9.1 Home

| #   | Section                                   | Content                                                                                                                                                                                                                                                                              |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Hero                                      | H1 headline (§6.1), sub-headline (§6.2), two CTAs: **Quickstart** (primary) and **GitHub** (secondary, with live star count). Right side or below: a real, un-mocked screenshot of the entry editor with the copilot panel docked. No stock illustration, no abstract gradient blob. |
| 2   | Direct answer                             | 50 words: what Ortha is, for the answer engines and the skimmers.                                                                                                                                                                                                                    |
| 3   | Code proof                                | Two panes: a 12-line `collection()` declaration on the left, the generated SQL migration on the right. This section carries more conviction than any other on the page.                                                                                                              |
| 4   | Value prop 1 — Schema as code             | §6.3.1, with a link to `/features/content-modeling`.                                                                                                                                                                                                                                 |
| 5   | Value prop 2 — AI with an authority model | §6.3.2. Show the proposal card UI. Link to `/ai`.                                                                                                                                                                                                                                    |
| 6   | Value prop 3 — Agent-ready                | §6.3.3. Show the MCP client config JSON. Link to `/mcp`.                                                                                                                                                                                                                             |
| 7   | Value prop 4 — Editorial workflows        | §6.3.4. Show the version diff. Link to `/features/publishing`.                                                                                                                                                                                                                       |
| 8   | Value prop 5 — Everything is a plugin     | §6.3.5. Show the `plugins.ts` array. Link to `/features/plugins`.                                                                                                                                                                                                                    |
| 9   | Comparison strip                          | A compact table against Strapi, Payload, Directus, Contentful across five rows: schema location, hosting, AI, agent protocol, licence. Link to `/compare`.                                                                                                                           |
| 10  | Honesty block                             | "What Ortha doesn't do yet" — four bullets from §4 and a link to `/roadmap`. This section will surprise stakeholders; keep it. It is the highest-trust element on the page.                                                                                                          |
| 11  | Quickstart                                | The actual six commands from the README, copyable.                                                                                                                                                                                                                                   |
| 12  | FAQ                                       | Six questions with `FAQPage` markup.                                                                                                                                                                                                                                                 |
| 13  | Footer CTA                                | Quickstart + GitHub + Discord.                                                                                                                                                                                                                                                       |

### 9.2 `/ai` — the copilot pillar

The most important page after home. Structure it around the objection, not the
feature: **technical buyers do not want AI in their CMS; they are afraid of it.**
Sell the constraint, then the capability.

1. H1: _An AI that can only do what you can do._
2. Direct-answer paragraph.
3. **The four guarantees**, each with its mechanism named:
   no identity of its own · writes are proposals · publishing is never exposed ·
   every call is audited.
4. **Run it on your own hardware.** The provider port, the local-model story, the
   one-setting switch. This is the section that converts regulated buyers.
5. **What it can do today** — the honest tool list from §3.9, marked read /
   propose.
6. **What it deliberately can't do**, and why.
7. Screenshots: the docked panel mid-answer, a tool step expanded, a proposal
   card with its field-level diff.
8. FAQ: prompt injection, data residency, cost control, model choice,
   turning it off.

### 9.3 `/mcp` — the agent pillar

The land-grab page. Optimize hard for `mcp cms` and `cms for ai agents`.

1. H1: _Your CMS, in your agent's toolbox._
2. Direct answer: what MCP is (two sentences, for readers who don't know) and
   what Ortha's endpoint gives them.
3. **Copy-pasteable client config** above the fold. The fastest possible path
   from "reading" to "working".
4. The twelve tools, tabulated with their required scope.
5. **The security model**: same tokens, same rules, `read` scope never sees the
   write tools, revoke kills it instantly, off by default.
6. Client setup guides: Claude Desktop, Cursor, custom SDK.
7. A worked example: "Ask Claude to audit which articles are missing German
   translations" — with the actual transcript.
8. FAQ.

### 9.4 Comparison pages — the template

Fairness is the strategy. A comparison page that a competitor's own team would
call accurate is the one that gets linked, cited by answer engines, and shared.

1. H1: _Ortha CMS vs <Competitor>: An Honest Comparison_
2. A one-paragraph verdict up top: **"Choose <Competitor> if… Choose Ortha if…"**
   Genuinely recommend the competitor where they're stronger.
3. A feature table with a factual, dated basis (state the version compared and
   the date checked).
4. Three to five sections on the differences that actually matter for that
   competitor.
5. **"Where <Competitor> is better"** — a real section with real content. This is
   mandatory, not decorative.
6. Migration notes.
7. FAQ.

### 9.5 `/pricing`

Ortha is MIT-licensed and self-hosted, so this page's real job is to remove the
"what's the catch?" objection, not to sell.

- Lead with: **Free. MIT licensed. Self-hosted. No feature gates, no record
  caps, no API call metering.**
- State what is _not_ included: no hosting, no support SLA, no managed
  infrastructure.
- If a commercial offering exists or is planned (managed hosting, support,
  enterprise features), say exactly what and when. If nothing is planned, say
  that too — ambiguity here reads as a bait-and-switch waiting to happen.
- Include a cost-comparison callout against per-record/per-seat SaaS pricing —
  it is the most concrete argument on the site for a budget holder.

---

## 10. Design direction

**The marketing site must look like the product, because the product's UI is the
best asset the project has.** Do not commission a separate marketing aesthetic.
Copy the admin's design language wholesale, then let real screenshots sit inside
a page that shares their palette, radii, borders and shadows — so the seam
between "the site" and "the app" disappears.

The system below is **not aspirational**. Every token, variant and constraint is
lifted verbatim from `apps/admin/src/styles.css`,
`packages/design-system/src/styles.css`, and the component sources in
`packages/design-system/src/lib/components/ui/`. The literal values are in
**Appendix A**; copy that block into the site's stylesheet rather than
re-deriving it.

### 10.1 The visual language in one paragraph

An **incident.io-style** system: a pure-white page canvas with **bordered cards**
that separate by hairline border plus a whisper of shadow (never by heavy
elevation), **ink primary buttons** (near-black, not a coloured brand button), a
**dark near-black chrome surface** for navigation, **true-gray neutrals** with no
warm cast for hovers and rings, and exactly **one vibrant accent — flame orange**
— held back for links, active icons and soft tinted highlights. Semantic status
colours (success, warning, info, destructive) each ship a **solid** and a **soft
tinted-chip** pair. It reads technical, dense and calm — closer to Linear,
Railway or Resend than to a gradient-and-blob SaaS template.

### 10.2 Colour — the rules that matter

Colour is authored in **OKLCH**, as Tailwind v4 `@theme` custom properties, with
the dark palette re-declaring the same token names under a `.dark` class.

**Five rules the site must not break:**

1. **Flame orange is an accent, never a button fill behind white text.**
   `--color-brand` at `oklch(0.66 0.2 35)` clears 3:1 against white — fine for
   icons, dots, rules and large accents — but **white text on it does not clear
   WCAG AA**. Use `--color-brand-text` (`oklch(0.55 0.18 35)`) for link-grade
   orange text, or put ink text on the orange. This is the single most likely
   mistake a marketing designer will make with this palette, and the product's
   own stylesheet carries a comment warning about it.
2. **The primary button is ink, not brand.** `bg-primary` is
   `oklch(0.25 0.015 285)` with near-white text. The hero's primary CTA is a
   black button. Resist the urge to "brand" it orange — the whole system's
   restraint depends on this.
3. **Cards separate by border + `shadow-xs`, not by elevation.** The canvas and
   the card are both pure white in light mode; the hairline border
   (`--color-border`) is what draws the box. In dark mode the card lifts one
   step above the canvas so it separates by surface _and_ border.
4. **Every text-on-surface pairing must clear 4.5:1**, and the product's own
   token set was verified against that. If you introduce a pairing that isn't in
   Appendix A, measure it.
5. **Form-control borders are darker than structural borders.**
   `--color-input` is a step darker than `--color-border` so inputs read as
   editable. Newsletter fields and search boxes on the site follow the same rule.

**The token families available:**

| Family           | Tokens                                                                                                 | Use on the site                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Surfaces         | `background`, `foreground`, `card`, `card-foreground`, `popover`, `popover-foreground`                 | Page canvas, feature cards, dropdowns                                                      |
| Ink primary      | `primary`, `primary-foreground`                                                                        | Every primary CTA                                                                          |
| Brand accent     | `brand`, `brand-foreground`, `brand-text`, `brand-soft`, `brand-soft-foreground`                       | Links, active states, tinted highlight blocks, the "new" chip                              |
| Neutrals         | `secondary`, `muted`, `muted-foreground`, `accent`, `accent-foreground`                                | Secondary buttons, quiet copy, row/nav hovers                                              |
| Status           | `success`, `warning`, `info`, `destructive` — each with `-foreground`, `-soft`, `-soft-foreground`     | Roadmap statuses (shipped/building/considering), comparison table marks, the honesty block |
| Accent-soft only | `teal-soft`, `violet-soft` (+ foregrounds)                                                             | Icon tiles for Media and Workspaces sections, matching the product's own area accents      |
| Chrome           | `sidebar`, `sidebar-foreground`, `sidebar-primary`, `sidebar-accent`, `sidebar-border`, `sidebar-ring` | The site's dark footer, and any dark section that echoes the app chrome                    |
| Nav icon accents | `nav-orange`, `nav-blue`, `nav-green`, `nav-violet`, `nav-amber`, `nav-teal`                           | Coloured icons **on dark surfaces only** — all lightened to L ≥ 0.72 to clear 3:1 there    |
| Avatar palette   | `avatar-slate/green/amber/violet/rose/teal/indigo`                                                     | Author avatars on the blog; white initials clear AA on all seven                           |
| Lines & focus    | `border`, `input`, `ring`                                                                              | Hairlines, form controls, focus rings                                                      |

**Feature-area colour coding.** The product assigns each area an accent — Content
is orange, Media teal, Workspaces violet, Insights blue/green — surfaced as a
soft-tinted icon tile in each page's top bar. **Mirror this on the site**: give
each feature spoke page the same tinted icon tile its area carries in the app, so
a reader who opens the product recognizes where they are. It is free continuity
and it costs one class.

### 10.3 Dark mode

The product ships full light/dark/system support, so the site must too — and it
must work the same way, or the two will feel like different products.

- Toggle by adding `.dark` to `<html>`, with
  `@custom-variant dark (&:where(.dark, .dark *))`.
- Use `@theme` (not `@theme inline`) so utilities resolve to `var(--color-*)` and
  the dark override takes effect at runtime.
- **Ship the pre-paint script.** The admin runs a tiny inline script in `<head>`
  that reads `localStorage['ortha.theme']` (`light` | `dark` | `system`), applies
  the class and sets `color-scheme` before first paint. Copy it verbatim,
  including the storage key — a visitor who set dark mode in the product should
  land on a dark marketing site.
- **In dark mode the semantic solids invert their foreground.** They are
  lightened to read on the near-black canvas, and a lightened fill can no longer
  carry white text at AA — so success/warning/info/destructive all take **ink**
  text in dark mode. Do not carry the light-mode `-foreground` values across.
- Note one asymmetry to preserve: the chrome tokens (`sidebar-*`) and the nav
  icon accents were authored dark from the start and **carry over unchanged**.

### 10.4 Shape, spacing and type

- **Radius:** `--radius: 0.625rem` (10px) is the base. Buttons and inputs are
  `rounded-lg`; badges and pills are `rounded-full`; the brand mark uses
  `rounded-md` at small size and `rounded-[14px]` at large.
- **Shadow:** `shadow-xs` on buttons and cards. Nothing heavier anywhere. There
  is no elevation scale to climb.
- **Focus ring:** `ring-2 ring-ring/40` with `focus-visible:outline-none` — a
  neutral gray ring, not a brand-coloured one. Every interactive element on the
  site gets it.
- **Typography:** the admin ships **no webfont** — it runs on the Tailwind
  default system stack. Two options, and this needs an owner's decision (§15):
  keep the system stack (zero webfont cost, instant text, perfect CWV, and
  literally identical to the product), or introduce one display face for the
  marketing site _and back-port it to the admin_ so they don't diverge.
  **Recommendation: keep the system stack for body and UI**, and if a brand face
  is wanted, use it for H1/H2 only, self-hosted, subset, `font-display: swap`.
- **Density:** the product is information-dense. The marketing site should be
  denser than a typical landing page — more content per viewport, less
  whitespace theatre. This audience scrolls to read, not to be walked through a
  story.

### 10.5 The brand mark

The product's `Logo` component is a **lucide `Hexagon` icon** in an ink badge
(`bg-primary` / `text-primary-foreground`) beside the wordmark **"Ortha CMS"** in
`font-medium`. Two sizes are defined: `sm` (24px badge, 16px icon, `rounded-md`)
for inline and toolbar use, `lg` (56px badge, 28px icon, `rounded-[14px]`) for
hero use. **Use exactly this** unless and until a designed logo replaces it — and
if one is commissioned, it must land in `packages/design-system` first and the
site should consume it from there, not the other way round.

**Icon library is lucide throughout.** The site uses no second icon set.

### 10.6 Components — reuse the vocabulary, not the code

The design system exports 45 components. The site should not import them (a
marketing site should not pull in Radix and TanStack), but it must **reproduce
their look exactly**. The ones that matter:

- **Button** — variants `default` (ink fill), `outline` (bordered on card),
  `secondary` (bordered, gray fill), `ghost`, `link` (brand-text, underline on
  hover), `destructive`. Sizes: default `h-9 px-4`, `sm` `h-8 px-3 text-xs`,
  `lg` `h-10 px-8`, `icon` `h-9 w-9`. **The hero's primary CTA is
  `variant="default" size="lg"`; the GitHub CTA is `variant="outline" size="lg"`.**
- **Badge** — `rounded-full`, `text-xs font-medium`. Soft variants (`success`,
  `warning`, `info`, `destructive-soft`, `primary-soft`) are the right tool for
  roadmap status chips, "new" markers and version pills. Solid variants for
  emphasis only.
- **Card** — the container for every feature block, comparison cell group and
  blog card.
- **TopBar / TopBarIcon** — the coloured icon tile + breadcrumb pattern. Reuse it
  as the header treatment on feature spoke pages (§10.2).
- **StatTile** — for any numbers the site shows.
- **Table** — for comparison tables. Use the product's own table styling so the
  `/compare` pages look like a product screen.
- **Alert** — `destructive`, `warning` and default variants. The honesty block on
  the home page and the `/roadmap` caveats should use the warning treatment.
- **Empty**, **Skeleton**, **Kbd**, **Separator**, **Tooltip**, **Tabs** /
  **TabNav** — for the docs, the keyboard-shortcut callouts (`⌘K`, `⌘J`, `⌘B`
  are real product shortcuts worth showing) and the framework-tabbed code
  samples.

Build these as a small local component set in the site repo, styled from the same
tokens. Document the mapping so a product-side token change can be pulled through
in one commit.

### 10.7 Motion — and the trap

**`tailwindcss-animate` / `tw-animate-css` are deliberately not installed in this
workspace.** The `animate-in`, `fade-in-0`, `zoom-in-95` classes that ship with
shadcn components therefore **generate no CSS at all**. Anyone copying markup out
of the product will silently get no animation — and worse, a keyframe-based
approach can leave an element stuck invisible when motion is disabled.

The product's answer, which the site should adopt:

- **Plain CSS transitions** for state changes, not keyframe entrances.
- **Transform-only entrances** where an entrance is wanted — opacity stays at 1
  throughout, so content is never hidden in a background tab, in print, or under
  reduced motion. The product's `wizard-step-in` is `translateY(6px) → 0` over
  **220ms ease-out**.
- **Dropdown/popover motion**: in at **140ms `cubic-bezier(0.16, 1, 0.3, 1)`**,
  out at **90ms ease-in** — a dismissal should feel immediate, an entrance
  placed. Reuse these two curves for every transition on the site so the timing
  feel matches.
- **Transition `translate` and `scale` as standalone properties, not
  `transform`.** Tailwind v4 emits them separately, so
  `transition-[opacity,transform]` fades the opacity while the movement snaps —
  a bug the product team hit and documented.
- **`prefers-reduced-motion: reduce` disables all of it**, and the reduced state
  must be the fully-visible state.
- No scroll-jacking, no parallax, no autoplaying video, no animated counters.

### 10.8 Small details that carry the product's feel

Cheap to copy, and collectively they are most of why the admin feels considered:

- **Thin, quiet scrollbars** — 8px, fully-rounded thumb coloured with the
  `border` token (so it tracks the theme), transparent track.
- **`::selection` is `bg-foreground/15`** — a neutral wash, not the browser blue.
- **Cursors**: Tailwind v4's preflight no longer sets `cursor: pointer` on
  buttons. The product restores it in a base layer for buttons, `[role="button"]`,
  checkbox labels and `summary`, and sets `cursor: not-allowed` on disabled
  controls. Copy that block or every control on the site will render an arrow.
- **Screenshots must be real, current, and captioned.** Capture at 2x on a seeded
  workspace with plausible content — never lorem ipsum, never an empty state
  dressed as a full one. Capture **both** themes and serve the one matching the
  reader's. Recapture on any release that changes the UI; put it on the release
  checklist.
- **Code blocks are a primary content type**, not a garnish: build-time
  highlighting (Shiki), copy buttons, filename headers, and tabbed variants where
  a snippet differs by framework. Use a Shiki theme derived from these tokens
  rather than an off-the-shelf one, in both light and dark.

### 10.9 Accessibility of the site itself

The product sells WCAG 2.1 AA as a tested design target. **A marketing site that
fails it disqualifies the claim**, and this audience will check. Non-negotiable:
axe clean at AA in the site's own CI, a real heading hierarchy, keyboard
operability throughout, visible focus on every interactive element, and the
reduced-motion and contrast rules above enforced rather than intended.

### 10.10 Recommended stack

**Astro** — content-first, ships near-zero JS by default, first-class MDX and
Shiki, and it will hit the Core Web Vitals budget in §7.4 without effort — with
**Tailwind v4** (matching the product, so the `@theme` block in Appendix A drops
straight in) and MDX for docs and blog. Next.js in SSG/ISR mode is the acceptable
alternative if the team already runs it. Deploy anywhere static.

---

## 11. Conversion design

**Primary conversion:** the visitor runs the quickstart. Everything else is
secondary.

- **One primary CTA per page.** "Quickstart" or "Read the docs" — never
  "Get started" (meaningless) and never "Book a demo" (wrong motion for this
  audience).
- **The GitHub CTA is second everywhere**, with a live star count. For an
  open-source project this is both social proof and a conversion.
- **A copyable install command in the hero of every developer-facing page.**
  Reduce the distance from reading to running to a single click.
- **Newsletter is a soft, footer-only ask** framed as release notes, not
  marketing. Offer the changelog RSS beside it for people who won't give an
  email.
- **Community link (Discord or GitHub Discussions) in the footer**, with the
  member count only if it is not embarrassing.
- **No modals, no exit-intent popups, no chat widgets, no cookie banner.**
  Each of these costs more credibility with this audience than it recovers in
  captured leads.

---

## 12. Content marketing plan

The blog is the primary discovery channel for layers 1 and 2 of the SEO
strategy. Ortha's development produced an unusual amount of genuinely
interesting engineering material — mine the ADRs and package docs; they are
already 80% of a good post each.

**Launch set (three posts):**

1. _Why we made the CMS an MCP server_ — adapted from ADR-0006. Targets the
   uncontested cluster. Cross-post to Hacker News and r/programming.
2. _An AI copilot with no authority of its own_ — adapted from ADR-0005. The
   authority model is a genuinely novel contribution and the strongest
   thought-leadership asset the project has.
3. _Content types as TypeScript, tables as migrations_ — the schema-as-code
   argument, with the generated SQL shown.

**Ongoing pipeline (each maps to a keyword cluster):**

- Localization done as rows, not JSON columns (Cluster D)
- Four publish states over two stored values, and why editors need the third
- Running your CMS copilot entirely on a local model (Cluster A)
- Building a plugin: adding a capability without touching the host (Cluster C)
- Why the filter picker and the SQL whitelist are the same traversal
- Making a headless CMS admin actually keyboard-usable (Cluster D/F)
- Migrating from Strapi to Ortha (Cluster B)
- Using Ortha with Next.js / Astro / Nuxt (Cluster E — one post per framework)

**Cadence:** two posts a month, sustained, beats twelve in one week and silence
after. Every post ends with a link to the relevant feature page and the
quickstart.

---

## 13. Deliverables and acceptance criteria

**Deliverables**

1. Phase 1 site (§8.2) — designed, built, deployed, indexed.
2. A local component set reproducing the design-system vocabulary in §10.6,
   built from the token block in **Appendix A**, with a documented mapping back
   to `packages/design-system` so a product-side token change pulls through in
   one commit.
3. Templated OG image generation, rendered from the same tokens (ink surface,
   hexagon mark, flame-orange accent) so a shared link looks like the product.
4. `sitemap.xml`, `robots.txt`, `/llms.txt`, blog and changelog RSS.
5. Structured data on every page type per §7.4.
6. Analytics (cookieless) with the quickstart click and the GitHub click as
   tracked goals.
7. A screenshot capture script and a documented recapture procedure tied to the
   release checklist.
8. A launch checklist covering Hacker News, r/selfhosted, r/programming,
   Product Hunt, the MCP server directories, and the awesome-\* lists for
   headless CMS and MCP.

**Acceptance criteria**

- Lighthouse ≥ 95 on Performance, Accessibility, Best Practices, SEO for every
  page in Phase 1.
- Zero axe violations at WCAG 2.1 AA, verified in the site's own CI.
- **Design fidelity**: the site's `@theme` block matches Appendix A token for
  token; light and dark both ship; the pre-paint theme script reads the same
  `ortha.theme` storage key as the product; the primary CTA is the ink button,
  not an orange one; and no white text sits on `bg-brand` anywhere.
- **Motion audit**: no `animate-in` / `fade-in-0` / `zoom-in-95` class appears in
  the built CSS (they generate nothing — their presence means a component was
  copied without checking), every entrance is transform-only, and
  `prefers-reduced-motion` resolves to the fully-visible state.
- Every page has a unique title, a unique meta description, a canonical URL,
  exactly one H1, and valid structured data.
- Every factual product claim on the site traces to a section of this document
  or to a file in the repository, and a reviewer has checked each one.
- Every code snippet on the site has been executed against a current build.
- Every screenshot is from the current release.
- No claim from §14's prohibited list appears anywhere on the site.

---

## 14. Accuracy guardrails — non-negotiable

**This section must accompany every excerpt of this brief given to a writer or
an agent.** The product's entire positioning rests on being more honest than the
category norm; a single overstated claim on the marketing site undermines every
carefully-worded guarantee on the `/ai` page.

**Do not claim, imply, or illustrate:**

- Email/SMTP delivery, invitation emails, or password-reset emails.
- Content export in any format.
- Full-text search, fuzzy search, semantic search, vector search, or embeddings.
- Analytics, insights, or dashboards beyond the home page's activity panel.
- Scheduled or timed publishing.
- Approval workflows or multi-step editorial review.
- Live preview or visual/page building.
- Webhooks or outbound event delivery to external systems.
- Real-time collaboration or multi-user co-editing.
- A finished S3 or cloud storage adapter.
- Per-workspace roles (roles are global per user).
- A settings UI for configuring AI models at runtime.
- MCP _client_ connectors (Ortha is an MCP server; connecting the copilot to an
  operator's own MCP servers is roadmap).
- Any AI capability to publish content.
- Any specific performance number, uptime figure, or benchmark not measured and
  documented.
- Any customer, user count, logo, testimonial, case study, or award.
- Any compliance certification (SOC 2, ISO 27001, HIPAA, VPAT). You may describe
  the _properties_ that support a compliance posture — self-hosting, audit
  trail, RBAC, WCAG 2.1 AA as a design target — but never assert a
  certification, and never state WCAG conformance as certified rather than as a
  standard the project builds and tests against.

**When in doubt:** describe the mechanism instead of asserting the outcome.
"Every tool call is written to an append-only audit table in the same
transaction as its effect" is both more credible and more checkable than
"enterprise-grade auditing".

---

## 15. Open decisions for the owner

These need a human answer before the site can be finished. Flagged, not assumed.

1. **Commercial model.** Is there a paid offering — managed hosting, support,
   enterprise add-ons — now or planned? `/pricing` cannot be written honestly
   without this.
2. **Domain and brand.** Final domain, and whether the product name is styled
   "Ortha CMS", "OrthaCms", or "Ortha" (the repository currently uses all three;
   pick one and normalize). The design-system `Logo` component's own label says
   **"Ortha CMS"**, which is the strongest argument for standardizing on that.
3. **Logo.** The current mark is a lucide `Hexagon` in an ink badge — functional
   placeholder, not a designed identity. Commission one, or ship with it? If
   commissioned, it lands in `packages/design-system` first and the site
   consumes it from there.
4. **Typeface.** Keep the product's system font stack (fastest, and identical to
   the app), or introduce a display face for headings and back-port it to the
   admin? Diverging here is the one thing that would break the
   site-looks-like-the-product effect. See §10.4 for the recommendation.
5. **The AI product name.** The code calls it `copilot`; the UI calls it
   **Ortha AI**. The site should use "Ortha AI" consistently — confirm.
6. **Hosted demo.** Is there budget to run a public, seeded, reset-nightly demo
   instance? It is the single highest-converting asset a CMS can offer, and its
   absence is felt.
7. **Community home.** Discord, GitHub Discussions, or both.
8. **Launch timing.** Whether to launch before or after email delivery ships —
   it is the most-felt gap in §4 and materially affects first-run experience.
9. **Site localization.** English-only at launch is the right call, but confirm;
   if not, `hreflang` and a translation workflow need designing up front.

---

## Appendix A — Design tokens, verbatim

Copy this into the site's stylesheet. It is the product's own theme block,
reproduced exactly from `apps/admin/src/styles.css` — light palette, dark
overrides, the avatar palette, and the base-layer rules that make controls and
scrollbars behave. Re-verify against that file before launch; if it has moved on,
it wins.

```css
@import 'tailwindcss';

@custom-variant dark (&:where(.dark, .dark *));

@theme {
    --radius: 0.625rem;

    /* Surfaces — pure-white canvas; cards separate via border + shadow. */
    --color-background: oklch(1 0 0);
    --color-foreground: oklch(0.21 0.012 285);
    --color-card: oklch(1 0 0);
    --color-card-foreground: oklch(0.21 0.012 285);
    --color-popover: oklch(1 0 0);
    --color-popover-foreground: oklch(0.21 0.012 285);

    /* Ink primary — the "contrast" button. NOT the brand colour. */
    --color-primary: oklch(0.25 0.015 285);
    --color-primary-foreground: oklch(0.985 0 0);

    /* Flame orange. `brand` = icons/accents (3:1 on white, NOT AA for white
       text on it). `brand-text` = AA link-grade orange text. */
    --color-brand: oklch(0.66 0.2 35);
    --color-brand-foreground: oklch(0.21 0.012 285);
    --color-brand-text: oklch(0.55 0.18 35);
    --color-brand-soft: oklch(0.955 0.025 40);
    --color-brand-soft-foreground: oklch(0.47 0.16 35);

    --color-secondary: oklch(0.945 0.003 285);
    --color-secondary-foreground: oklch(0.25 0.012 285);
    --color-muted: oklch(0.975 0.003 285);
    --color-muted-foreground: oklch(0.49 0.015 285);
    --color-accent: oklch(0.975 0.003 285);
    --color-accent-foreground: oklch(0.21 0.012 285);

    --color-destructive: oklch(0.55 0.22 27);
    --color-destructive-foreground: oklch(0.985 0 0);
    --color-destructive-soft: oklch(0.95 0.025 20);
    --color-destructive-soft-foreground: oklch(0.44 0.17 27);

    --color-success: oklch(0.52 0.14 150);
    --color-success-foreground: oklch(0.985 0 0);
    --color-success-soft: oklch(0.95 0.045 150);
    --color-success-soft-foreground: oklch(0.42 0.11 150);

    --color-warning: oklch(0.55 0.12 66);
    --color-warning-foreground: oklch(0.985 0 0);
    --color-warning-soft: oklch(0.95 0.045 80);
    --color-warning-soft-foreground: oklch(0.44 0.1 60);

    --color-info: oklch(0.52 0.17 255);
    --color-info-foreground: oklch(0.985 0 0);
    --color-info-soft: oklch(0.945 0.03 255);
    --color-info-soft-foreground: oklch(0.42 0.14 260);

    /* Accent-only soft pairs — area icon tiles (Media = teal, Workspaces =
       violet). Same L/C recipe as the *-soft pairs above. */
    --color-teal-soft: oklch(0.94 0.035 190);
    --color-teal-soft-foreground: oklch(0.4 0.08 190);
    --color-violet-soft: oklch(0.945 0.035 300);
    --color-violet-soft-foreground: oklch(0.42 0.14 300);

    --color-border: oklch(0.9 0.008 285);
    --color-input: oklch(
        0.84 0.01 285
    ); /* darker: form controls read editable */
    --color-ring: oklch(0.55 0.01 285); /* neutral gray focus ring */

    --color-status-active: oklch(0.63 0.17 149);
    --color-status-invited: oklch(0.67 0.14 70);

    /* Dark chrome — the app's sidebar surface. Authored dark, so it does NOT
       flip in dark mode. Use for the site's dark footer / chrome sections. */
    --color-sidebar: oklch(0.21 0.012 285);
    --color-sidebar-foreground: oklch(0.93 0.005 285);
    --color-sidebar-primary: oklch(0.66 0.2 35);
    --color-sidebar-primary-foreground: oklch(0.21 0.012 285);
    --color-sidebar-accent: oklch(0.3 0.018 285);
    --color-sidebar-accent-foreground: oklch(0.985 0.002 285);
    --color-sidebar-border: oklch(0.31 0.012 285);
    --color-sidebar-ring: oklch(0.75 0.01 285);

    /* Nav-icon accents — ON DARK SURFACES ONLY. L >= 0.72 so each clears 3:1
       against the dark chrome. Do not use these on white. */
    --color-nav-orange: oklch(0.72 0.17 40);
    --color-nav-blue: oklch(0.74 0.11 250);
    --color-nav-green: oklch(0.74 0.13 150);
    --color-nav-violet: oklch(0.76 0.11 300);
    --color-nav-amber: oklch(0.78 0.13 80);
    --color-nav-teal: oklch(0.75 0.1 190);
}

/* Dark theme. Only the light-surface tokens flip; the chrome and nav accents
   above carry over unchanged. Note the semantic solids invert their FOREGROUND
   to ink — a lightened fill cannot carry white text at AA. */
.dark {
    --color-background: oklch(0.175 0.012 285);
    --color-foreground: oklch(0.95 0.004 285);
    --color-card: oklch(0.215 0.012 285);
    --color-card-foreground: oklch(0.95 0.004 285);
    --color-popover: oklch(0.215 0.012 285);
    --color-popover-foreground: oklch(0.95 0.004 285);

    --color-primary: oklch(0.92 0.004 285);
    --color-primary-foreground: oklch(0.21 0.012 285);

    --color-brand: oklch(0.7 0.19 40);
    --color-brand-foreground: oklch(0.21 0.012 285);
    --color-brand-text: oklch(0.8 0.14 45);
    --color-brand-soft: oklch(0.29 0.05 40);
    --color-brand-soft-foreground: oklch(0.83 0.11 45);

    --color-secondary: oklch(0.28 0.008 285);
    --color-secondary-foreground: oklch(0.95 0.004 285);
    --color-muted: oklch(0.25 0.006 285);
    --color-muted-foreground: oklch(0.72 0.012 285);
    --color-accent: oklch(0.27 0.008 285);
    --color-accent-foreground: oklch(0.95 0.004 285);

    --color-destructive: oklch(0.65 0.2 25);
    --color-destructive-foreground: oklch(0.21 0.012 285);
    --color-destructive-soft: oklch(0.3 0.08 20);
    --color-destructive-soft-foreground: oklch(0.83 0.11 25);

    --color-success: oklch(0.62 0.14 150);
    --color-success-foreground: oklch(0.21 0.012 285);
    --color-success-soft: oklch(0.3 0.06 150);
    --color-success-soft-foreground: oklch(0.83 0.12 150);

    --color-warning: oklch(0.7 0.13 70);
    --color-warning-foreground: oklch(0.21 0.012 285);
    --color-warning-soft: oklch(0.32 0.06 70);
    --color-warning-soft-foreground: oklch(0.86 0.1 82);

    --color-info: oklch(0.62 0.15 255);
    --color-info-foreground: oklch(0.21 0.012 285);
    --color-info-soft: oklch(0.3 0.07 255);
    --color-info-soft-foreground: oklch(0.83 0.1 258);

    --color-teal-soft: oklch(0.3 0.05 190);
    --color-teal-soft-foreground: oklch(0.83 0.08 190);
    --color-violet-soft: oklch(0.31 0.06 300);
    --color-violet-soft-foreground: oklch(0.85 0.1 300);

    --color-border: oklch(0.3 0.008 285);
    --color-input: oklch(0.4 0.01 285);
    --color-ring: oklch(0.62 0.01 285);

    --color-status-active: oklch(0.7 0.16 149);
    --color-status-invited: oklch(0.74 0.13 70);
}

/* Avatar accents — white initials clear AA (>= 5.7:1) on all seven. Declared
   as plain custom properties, not @theme: they are applied via inline
   `var(--color-avatar-…)` styles, and Tailwind tree-shakes @theme tokens no
   generated utility references. */
:root {
    --color-avatar-slate: oklch(0.5 0.05 250);
    --color-avatar-green: oklch(0.5 0.11 150);
    --color-avatar-amber: oklch(0.5 0.1 70);
    --color-avatar-violet: oklch(0.5 0.16 300);
    --color-avatar-rose: oklch(0.5 0.15 15);
    --color-avatar-teal: oklch(0.5 0.08 190);
    --color-avatar-indigo: oklch(0.5 0.16 275);
}

@layer base {
    * {
        @apply border-border;
    }
    body {
        @apply bg-background text-foreground;
    }

    /* Thin, quiet scrollbars — thumb tracks the theme via the border token. */
    * {
        scrollbar-width: thin;
        scrollbar-color: var(--color-border) transparent;
    }
    ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }
    ::-webkit-scrollbar-track,
    ::-webkit-scrollbar-corner {
        background: transparent;
    }
    ::-webkit-scrollbar-thumb {
        border-radius: 9999px;
        background-color: var(--color-border);
    }
    ::-webkit-scrollbar-thumb:hover {
        background-color: var(--color-muted-foreground);
    }

    ::selection {
        @apply bg-foreground/15;
    }

    /* Tailwind v4 preflight no longer points the cursor at buttons. Without
       this, nothing on the site reads as clickable. */
    button:not(:disabled):not([aria-disabled='true']):not([data-disabled]),
    [role='button']:not([aria-disabled='true']):not([data-disabled]),
    label:has(> input[type='checkbox']:not(:disabled)),
    summary {
        cursor: pointer;
    }

    button:disabled,
    button[aria-disabled='true'],
    [role='button'][aria-disabled='true'],
    [data-disabled] {
        cursor: not-allowed;
    }
}

/* Motion. `tailwindcss-animate` is NOT installed — `animate-in` / `fade-in-0` /
   `zoom-in-95` generate no CSS. Entrances are transform-only so content is
   never hidden when the motion clock is paused or reduced motion is on. */
@keyframes rise-in {
    from {
        transform: translateY(6px);
    }
    to {
        transform: translateY(0);
    }
}
.rise-in {
    animation: rise-in 220ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
    .rise-in {
        animation: none;
    }
}
```

**The pre-paint theme script** — put this in `<head>` before the stylesheet, so a
dark-mode visitor never sees a flash of the light canvas. The storage key is
shared with the product on purpose.

```html
<script>
    (function () {
        try {
            var stored = localStorage.getItem('ortha.theme');
            var theme =
                stored === 'light' || stored === 'dark' || stored === 'system'
                    ? stored
                    : 'system';
            var dark =
                theme === 'dark' ||
                (theme === 'system' &&
                    window.matchMedia('(prefers-color-scheme: dark)').matches);
            var root = document.documentElement;
            root.classList.toggle('dark', dark);
            root.style.colorScheme = dark ? 'dark' : 'light';
        } catch (e) {}
    })();
</script>
```

**Motion curves to reuse for every transition on the site:**

| Purpose           | Duration | Easing                          |
| ----------------- | -------- | ------------------------------- |
| Entrance (placed) | 140ms    | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Exit (immediate)  | 90ms     | `ease-in`                       |
| Content rise-in   | 220ms    | `ease-out` (transform only)     |

**Component quick reference** (§10.6 for the full list):

| Element        | Spec                                                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary button | `bg-primary text-primary-foreground rounded-lg shadow-xs h-9 px-4 text-sm font-medium`, hover `bg-primary/90`                                                             |
| Large CTA      | as above at `h-10 px-8`                                                                                                                                                   |
| Outline button | `border border-input bg-card shadow-xs`, hover `bg-accent`                                                                                                                |
| Link           | `text-brand-text underline-offset-4 hover:underline`                                                                                                                      |
| Badge / chip   | `rounded-full border px-2.5 py-0.5 text-xs font-medium`; soft variants for status                                                                                         |
| Focus ring     | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40`                                                                                              |
| Card           | `bg-card border border-border rounded-[0.625rem] shadow-xs`                                                                                                               |
| Brand mark     | lucide `Hexagon` in `bg-primary text-primary-foreground`; sm 24px badge / 16px icon / `rounded-md`, lg 56px / 28px / `rounded-[14px]`; wordmark "Ortha CMS" `font-medium` |
| Icons          | lucide-react, `size-4` inside buttons                                                                                                                                     |
