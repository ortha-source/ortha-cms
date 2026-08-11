# @ortha-cms/i18n-server

> **Layout: layered (ADR-0003).** A **light** application of tactical DDD — this
> is a small, low-invariant context, so it gets a `domain/` layer for value
> objects and the pure locale policy, but **not** a full aggregate /
> unit-of-work / outbox split (there is no write aggregate here — the plugin
> owns no tables). The defining feature stays a **synchronous open-host port**
> (see below). Follow the `workspaces-server` pilot for the layered idioms and
> the `server-plugin` skill for the plugin mechanics.

## Layering (ADR-0003)

```
domain/                       # framework-free core — imports NOTHING from
                              # @nestjs/*, drizzle-orm, class-validator
  value-objects/locale.ts     # Locale — the slug-format + non-blank-name rule
  value-objects/locale-set.ts # LocaleSet — non-empty, unique, exactly-one-default,
                              #   can't-remove-the-default guards
  locale-policy.ts            # LocalePolicy — pure fallback-chain resolution
                              #   (resolve / shouldWidenToDefault / fallbackChain)
                              #   + requiredLocalesForPublish
  errors/                     # transport-agnostic domain errors
locales/services/             # LocaleRegistryService — wraps LocaleSet/LocalePolicy,
                              #   exposes the plain LocaleDef shape, maps
                              #   UnknownLocaleError → HTTP 400
content/ + locales/controllers# thin HTTP surface (unchanged)
```

The raw slug regex and the config invariants that used to live inline on the
plugin factory now live on `Locale` / `LocaleSet`; `assertConfig` is just
`LocaleSet.fromDefs(config.locales)`, and the runtime services resolve locales
through `LocalePolicy`. The `domain/` classes are plain (no `@Injectable`) — the
registry is the single `@Injectable()` seam that adapts them to DI.

### Decision — `CONTENT_ENTRY_EXTENSION` stays a synchronous port

`EntryLocaleExtensionService` binds content-server's `CONTENT_ENTRY_EXTENSION`
port to add per-locale row scoping **in-transaction, synchronously**. This is
**deliberately left as-is** and is **not** turned into a domain-event /
subscriber: the extension must run _inside_ content's entries pipeline
(list scoping, create stamping, shared-field sync + re-validation, virtual
filters), so a port — not an event — is the right integration. ADR-0003 is
explicit that the layering does **not** force events where an open-host port is
correct; the port's shape, wiring, and synchronous contract are unchanged by
this refactor. `LocalePolicy` is the pure re-expression of the fallback rule the
adapter's SQL encodes; the adapter keeps rendering the query.

`afterUpdate` **returns the sibling rows it rewrote**. Content-server appends a
revision for each, in the same transaction — a sibling whose shared values moved
gets the history entry it earned, instead of its timeline skipping the change
(and a later restore silently undoing it). Revision writing stays on content's
side on purpose: numbering is serialized per entry by an advisory lock, so a
second writer allocating numbers out-of-band is how duplicate versions happen.

The content-**localization** plugin for the Ortha CMS server. It makes
`i18n: true` content types multilingual — **one row per locale**, siblings
sharing a `locale_group_id` — **without the content library knowing what a
locale means**. It owns **no tables and no migrations**: the `locale` /
`locale_group_id` columns live on the host-owned generated content tables (the
`i18n: true` type flag adds them via content-server's table builder), and the
available locales live in this plugin's **config**.

## How it plugs in — the `CONTENT_ENTRY_EXTENSION` port

content-server declares a DI port (`CONTENT_ENTRY_EXTENSION` + the
`ContentEntryExtension` interface) and consults it **optionally** from the
entries pipeline; this plugin **binds** the implementation
(`EntryLocaleExtensionService`) in a `global: true` module. Same inversion as
identity's `CONTENT_CATALOG`, roles swapped: the consumer of the behavior
declares the port, the provider binds it. Every method **no-ops for non-i18n
types**, so binding the extension never changes an unrelated type's behavior.

The extension owns all locale _behavior_:

- **`listScope`** — the extra `WHERE` AND-ed into the entries list. Validates
  `?locale=` (unknown → 400), defaults to the configured default locale when
  absent, and scopes **strictly** (`locale = X` — untranslated groups are
  hidden). `?localeFallback=default` widens it to "the requested locale OR the
  default-locale row of a group that has no requested-locale row" (the relation
  picker's mode).
- **`createColumns`** — stamps the validated `locale` on a create. With no
  `localeGroupId` the group id comes from the column default (a plain create
  starts a fresh group); **with** a `localeGroupId` the new row **joins that
  group** as a sibling translation — verified to name a real group in the
  workspace first (else **404**), so a typo can't spawn a stray one-row group.
  This is why sibling creation needs no dedicated endpoint (see HTTP surface).
- **`afterUpdate`** — runs inside **both the create and update** transactions
  (so a newly-created sibling lands consistent with its group, not just later
  edits). Syncs every **non-`localized`** column-backed field to the group's
  sibling rows, **moves a rewritten published sibling back to `draft`** (keeping
  `published_at`, exactly as a direct edit does — so it reads as _Modified_, not
  as a never-published draft), then **re-validates any sibling that was
  published** via content-server's `EntryValidationService` — a failure throws
  422 and rolls the whole save back (a draft edit can't silently invalidate a
  live translation). The demotion is what keeps a shared field's publish state
  consistent across the group: leaving siblings `published` made the same edit
  live in the untouched locales while still pending in the edited one, and left
  each sibling's freshly-appended **draft** version describing a row that
  claimed to be live. Because the guard's `published` test would then always
  read the just-demoted status, the pre-write statuses are captured with a
  `SELECT … FOR UPDATE` before the sync. A no-op when the
  group has no other members (a fresh create).

    **Relations sync too**, per content-server's `relationLocaleSync` (the rule
    lives there; this is only the machinery). Three kinds of state travel,
    computed once and applied per sibling: shared **columns** (identical
    everywhere), **mirrored** single-relation FKs (the source's target resolved
    into each sibling's own locale), and the **link sets** of join-backed
    relations (verbatim when shared, mapped through the target's translation group
    when mirrored, order preserved). A sibling matching on all three is left
    completely untouched — that guard is what stops one save re-versioning the
    whole group; a links-only change still writes the row, so it earns its
    revision and its draft demotion.

    A **create** runs the sync inward instead (`inheritRelationsFromGroup`): a new
    translation carries none of the record's links, so it fills them from a donor
    sibling — deterministically the default-locale row where the group has one —
    and columns it derives are written back onto the row object, since the caller
    snapshots it as version 1. Columns still propagate outward on a create, which
    is what makes a deliberately different shared value on a create win.

    A **mirrored link whose target has no translation in a sibling's locale is
    left unset**, never a failed save: an English save must not be blocked because
    a German tag doesn't exist yet. That is what
    `RelationLinkService.equivalentIdsByLocale` is for — the lenient counterpart
    of `resolveLocaleGroups`, which throws 422 (right for an explicit API call
    naming a group, wrong for an implicit sync). An unresolvable mirrored FK is
    nulled rather than left pointing at the _previous_ record's translation, which
    would be silently wrong data.

- **`filterExtension`** — the virtual filter fields `hasLocale` /
  `missingLocale` (enum of slugs) and `localeCount` (number), resolved to
  `EXISTS` / correlated-count subqueries over the group (ridden by the
  `(locale_group_id, locale)` unique index). Wired through the filter engine's
  `extensionFields` + `resolveExtension` seam.

## Config — the single source of truth for locales

`I18nServerPlugin({ locales: [{ slug, name, isDefault }] })` validates
**eagerly at construction** (like `ContentPlugin`'s registry): ≥1 locale;
unique, well-formed slugs (`^[a-z]{2,3}(-[a-z0-9]+)*$`); **exactly one**
default. A misconfigured host fails before boot. `LocaleRegistryService`
exposes `all()` / `get(slug)` / `default()` / `resolve(slug?)` (the uniform
unknown-→400 gate). Register it in `apps/server/ortha.config.ts` under
`plugins.i18n` and in `buildPlugins` **after** `ContentPlugin` (it binds
content's port and reads its `CONTENT_REGISTRY`).

## HTTP surface (`/api/i18n`)

This plugin's content routes are **reads only** — sibling _creation_ goes
through content-server's `POST /api/content/:type` with a `localeGroupId` (see
`createColumns` above). All are workspace-scoped (identity's `WorkspaceGuard`)
and permission-gated; a `:typeName` that isn't localized is a **400**
(`resolveI18nType`).

- `GET /api/i18n/locales` — the configured locales (session only; no
  per-workspace data).
- `GET /api/i18n/content/:typeName/:id/locales` — one entry's **locale panel**:
  one item per configured locale with the group's row (id, status,
  **publishedAt**, updatedAt) or null (`content:read`).
- `GET /api/insights/i18n/coverage` — localization coverage for the Insights
  card (`content:read`). Under `insights/` rather than `i18n/` on purpose — see
  the section below.
- `POST /api/i18n/content/:typeName/locale-summary` — the records table's
  **batched** per-page read: `{ groupIds }` (cap 100) → per-group live members
  with status **+ publishedAt**. A POST because a page of uuids outgrows a query string; it reads,
  so no `OriginGuard` (`content:read`).

## Insights read-model (`/api/insights/i18n/coverage`, `src/lib/insights/`)

The aggregate behind the **Translation coverage** card on the Insights page:
per configured locale, how many of the workspace's localized records exist in
it; the same four figures again **per content type**; and the workspace totals.
`content:read` + `WorkspaceGuard`, read-only, no `?days=` (an untranslated
record is untranslated regardless of when it was written).

**One payload serves both of the card's breakdowns**, by language and by type.
They are different questions — "which language is behind?" and "which content
type is the work in?" — asked by the same person a moment apart, and the
per-type figures cost **no extra queries**: the method already loops per type to
build the workspace totals, so it now keeps what it was throwing away. A type
the workspace has never used is **omitted** rather than listed at zero, the same
rule the content pipeline applies.

**Mounted under `insights/`, not this plugin's `i18n/` prefix** — the Insights
endpoints are grouped by what they are, beside content's and media's, so a
reader looking for a card's data finds it next to the other cards'.

**Why the query lives here rather than in content-server.** Coverage is a
question about a set content deliberately does not know: the _configured_
locales. content-server owns the `locale` column's shape and nothing about what
a locale means, so it can report which slugs appear in the data but not which
ones are **missing** — and missing is the entire widget.
`LocaleRegistryService` is the source of that set, and it is here.

Four rules `LocalizationCoverageQuery` encodes:

- **The unit is a record, not a row.** A localized entry is one row per
  language, so counting rows would report 40 stories in 3 languages as 120
  things and make every share on the card wrong. Everything counts
  `locale_group_id`s.
- **Rows in an unconfigured locale are filtered out**, and that is what makes
  "complete" mean what it says. A slug the host has since dropped is not
  coverage of anything, and leaving it in would push a group's distinct-locale
  count past the configured total — so a record could be over-covered and still
  not counted as complete. A group made entirely of such rows drops out, which
  is the right answer rather than a record with zero languages.
- **`notLocalized` is a subset of `requiresLocalization`, not a second slice.**
  A record in one of four languages both has no translations and needs some.
  They are separate figures because they are separate jobs. With a single locale
  configured `notLocalized` is forced to `0` — there is nowhere to translate to,
  so every record would otherwise be reported as both fully localized and not
  localized at all.
- **The per-type rows partition the workspace figures.** Each type's
  `requiresLocalization` sums to the envelope's, and so on for the rest — which
  is what makes the card's two breakdowns tell the same story rather than two.
  A server-e2e case asserts the sum, because a per-type figure that drifts from
  the total is exactly the kind of wrongness a dashboard is believed on.

Implementation note: the group spread (`records` / complete / single) is one
grouped subquery folded by an outer aggregate. Reading a row per group and
counting in JS would pull the workspace's whole content set over the wire to
produce three integers.

**Creating a sibling translation:** `POST /api/content/:typeName` with
`{ values, locale, localeGroupId }` — the client supplies the source's values,
the extension validates + stamps the group, and the row lands as a fresh draft.
A duplicate locale in the group is a **409** (the `(locale_group_id, locale)`
unique index is the arbiter); an unknown group is a **404**. The new row's
relations are filled in by the extension from the group it joined, so the client
sends none — and a **mirrored** one it _did_ send would be rejected as a
cross-locale link (the source's id names another language's row).

## The agent tools (`src/lib/copilot/`)

`I18nCopilotToolProvider` binds two read tools, registered by
`copilotToolsRegistrar('i18n', …)` in `I18nModule.forRoot` (the registry is
injected **optionally** — a deployment running neither the copilot nor MCP is
normal).

**The two land on different surfaces, which is worth reading before adding a
third.** Same file, same plugin, opposite answers to "who is this for?":

- **`i18n_locales_list`** — **shared with the MCP endpoint** (no `surfaces`
  field). It returns deployment configuration, identical for every caller, with
  no workspace data and no publish state to leak, and an external agent needs it
  for exactly the reason the copilot does: `?locale=` on the public reads takes
  a slug that appears in no schema and no system prompt, so without it a client
  either omits the parameter and silently reads the default language or guesses
  and gets an error. One cheap call replaces both failure modes.
- **`i18n_translations_get`** — **copilot-only**, and the reason is easy to
  miss. `LocaleGroupService.entryLocales` builds its predicate from a
  `liveWhere` that scopes to workspace and soft-delete but **not** publish
  state, so it reports a draft sibling *and its status*. An MCP `read` token
  must not see that — the endpoint's own `content_translations` is
  published-only — and widening the tool to match would take the answer away
  from the copilot, which is where it is useful. It otherwise answers "which
  languages is this in, and which is missing?" from the same service the admin's
  locale panel reads, one item per **configured** locale, so a missing
  translation is `entry: null` rather than an absent key.

The deciding question is always what the tool would show a **token** holding
`content:read`, not which consumer asked for it; the full checklist is in
[`tools/server`](../../tools/server/AGENTS.md#adding-a-tool-decide-surfaces-deliberately).

It also binds **`i18n_propose_translation`** (`effect: 'propose'`), which
translates an entry into another locale. Since
[ADR-0009](../../../docs/adr/0009-copilot-applies-directly.md) the change is
applied as soon as it is drafted, so the tool's own checks are the last ones
before a write: resolve the slug against the configured set, confirm the target
locale does not already exist in the group (a duplicate is a 409), and refuse a
**shared** field — one value across the whole group by definition, so a
per-locale version of it would either be ignored or silently overwrite every
sibling.

`TranslationProposalApplier` creates the sibling through
`EntryWriterService.create` with a `localeGroupId`. There is deliberately no
"create translation" write path to reuse — joining a group is what that argument
already means, and the bound extension stamps and validates it inside the write
transaction, which is also what makes a duplicate `(group, locale)` a clean 409
instead of a corrupt group.

**It reads the source entry first, and must keep doing so.** The tool accepts
only localized values, but a create is a whole row: `coerceValues` stamps every
declared field, so a shared field nobody supplied arrives as `null` rather than
absent. Two things then go wrong at once — the new row fails its own required
check (`tag.slug` is required _and_ shared, so no translation of a tag ever
carries it), and, worse, `afterUpdate` treats that `null` as a shared value the
save carries and pushes it onto every sibling. A published sibling is
re-validated and fails, rolling the create back with "Entry validation failed";
a group of drafts has no such guard and the shared field is **silently blanked
in every locale**. So the applier seeds the create from the source row's shared
values — the same thing the admin's own create-translation does by sending the
source's values, which is why that path never hit this. The values then match
the group, `IS DISTINCT FROM` finds nothing to sync, and no sibling is touched.

Two rules the tools apply that the HTTP path does not:

- **They re-check the workspace's content grants** (via content-server's
  exported `WorkspaceGrantsQuery`). `resolveI18nType` deliberately does not —
  its callers are already behind a workspace-scoped controller reached from the
  admin's own UI — but a tool's type name arrives from the _model_, which is
  steerable by content it has read. "Not granted" and "does not exist" are the
  same message, so a run cannot enumerate the deployment's other types.
- **"Not localized" is an explicit error**, not an empty answer. `[]` would read
  as "this entry has no other languages" when the truth is "this content is not
  translated at all" — the same distinction the public API draws by 400-ing
  `?translations=preview` on a plain type.

## Architecture / conventions

- Feature-then-kind layout (`locales/`, `content/{services,controllers,dto}`),
  thin controllers, permission-by-constant, `interface` for contracts, JSDoc on
  exports — the `server-plugin` skill.
- Depends on `@ortha-cms/content-server` (the port + `toColumns`/`toRecord` +
  `EntryValidationService` + `RelationLinkService` + the `relationLocaleSync`
  helpers + `CONTENT_REGISTRY`), `@ortha-cms/identity-server`
  (guards + `lockWorkspaceShared`), `@ortha-cms/database` (`@InjectDatabase()`),
  `@ortha-cms/utils-server` (`isUniqueViolation`), `@ortha-cms/bootstrap-server`.
- **No `drizzle.config.ts`, no `migrations/`** — nothing to own. A future
  per-locale settings table would be the first candidate.

## Commands

- `npx nx typecheck @ortha-cms/i18n-server` / `npx nx lint @ortha-cms/i18n-server`
- `npx nx test @ortha-cms/i18n-server` (config-validation unit tests)
- End-to-end: `apps/server-e2e/src/server/i18n/` (needs Docker), plus
  `apps/server-e2e/src/server/insights/localization-insights.spec.ts` for the
  coverage aggregate — the record-vs-row fold is exactly what a mocked admin
  test cannot exercise.
