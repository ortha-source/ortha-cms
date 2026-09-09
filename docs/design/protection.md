# Publication protection — design

> **Status:** proposed, nothing built. The decision behind it is
> [ADR-0017](../adr/0017-publication-protection.md); this document is the
> technical description that record deliberately does not carry. Once the
> packages exist, their `AGENTS.md` files become the reference for their own
> internals and this file keeps the cross-cutting picture.

## What it is

A **protection rule** says that entries of one content type, in one workspace,
need N approvals before they may be published. It is branch protection, not a
workflow: there is no chain of stages, no assignment, no new entry status. An
approval either exists on the current version or it does not.

Three properties carry the whole design, and the rest follows from them:

- **An approval belongs to a revision.** `content_entry_revisions` already
  snapshots every save, numbered per entry and keyed per locale. An approval
  carries `revision_id`, so a later save leaves it off the head with no
  dismissal logic.
- **It authorizes, it never validates.** The publish gate keeps sole ownership
  of "is this entry complete" ([ADR-0015](../adr/0015-alarms-are-non-blocking.md));
  protection only answers "may this person ship it now".
- **It is inert until a rule exists.** No row, no predicate, no extra query, no
  chip. Every current installation is in that state.

## The path a publish takes

```
"Publish" pressed
  └─ PermissionsGuard — content:publish            ← 403, and the button was never rendered
       └─ publish gate — required field values     ← 422, button disabled with the failing checks
            └─ CONTENT_PUBLISH_GUARD port          ← 409, blocked: "2 approvals required, 0 given"
                 ├─ no rule, or enough approvals ──┐
                 └─ blocked + bypass allowed       │  admin only, reason mandatory,
                      └─ entry.publish_bypassed ───┤  entry.publish_bypassed to activity
                                                   ▼
                                            status → published
```

The first two gates are unchanged and keep their meanings. Protection is the
third, and a bypass passes **only** the third: an incomplete entry stays
unpublishable for an administrator too.

### The port, not a patch

`content-server` already declares `CONTENT_READ_SCOPE`, which `segments` fills to
compile reader entitlements into one SQL predicate. Protection uses the same
shape: content declares **`CONTENT_PUBLISH_GUARD`**, protection registers a guard
against it, and with nothing registered the port resolves to "always allowed"
without awaiting anything.

**It is a registry, not a single binding**, for the reason `read-scope.ts` sets
out at length: Nest has no multi-provider, so two dynamic modules binding one
token do not merge — the second silently replaces the first. For a read scope
that means content quietly becoming visible; for a publish guard it means
protection quietly switched off, which is worse, because the installation that
bought the rule is the one that would never notice. Several guards AND together:
any refusal refuses.

That keeps the dependency arrow one-way (`protection → content`, never back),
puts the decision in front of every caller of the publish path at once — admin,
REST, GraphQL mutation, MCP tool, transfer import — and means content-server
needs no knowledge of rules, approvals or revisions beyond calling a port it
already knows how to declare.

A guard returns a verdict, and an allowing verdict may carry **events** for
content to commit with the status write. That is how `entry.publish_bypassed`
lands in the same transaction as the publish it excuses, without content
learning what a bypass is.

## The rule

One row per `(workspace, content type)`. There is no condition and no per-entry
exception: "why is this entry blocked and its neighbour not" must answer in one
word, and the word is the type.

| Field | Default | Meaning |
| --- | --- | --- |
| `enabled` | `false` | Off means the type behaves exactly as today. |
| `required_approvals` | `1` | How many approvals on the head revision unlock publication. |
| `require_other_person` | `true` | The author of the head revision cannot approve it. This is the four-eyes switch. |
| `count_stale_approvals` | `false` | When on, approvals given on earlier revisions still count. Offered because someone will ask; the editor labels it as not recommended. |
| `admin_bypass` | `true` | An administrator may publish past the rule, with a mandatory reason. Off makes the rule absolute. |
| `allow_token_publish` | `false` | Off means a bearer token cannot publish this type at all. |

## Data model

Three tables, owned by `protection-server`, shipped with its own migrations.

### `protection_rules`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` pk | |
| `workspace_id` | `uuid` not null | |
| `kind` | `text` not null | `collection` \| `single`. **Text, not the `content_kind` enum** — that enum belongs to `workspaces`' schema, and importing another plugin's schema object to share a type is a dependency this package should not take. A check constraint carries the values. |
| `slug` | `text` not null | The code-defined type name. |
| `enabled`, `required_approvals`, `require_other_person`, `count_stale_approvals`, `admin_bypass`, `allow_token_publish` | | The six fields above. |
| `updated_by` | `uuid` | Who last changed the rule — the audit row names it too, this is for the settings screen. |
| `created_at`, `updated_at` | `timestamptz` | |

`unique (workspace_id, kind, slug)` — the same shape `workspace_content` uses.
Index on `workspace_id`.

### `review_requests`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` pk | |
| `workspace_id` | `uuid` not null | Every read AND-s it in. |
| `content_type` | `text` not null | |
| `entry_id` | `uuid` not null | The live row, one per locale. |
| `revision_id` | `uuid` not null | The head at the moment of asking. Kept for the trail; the request stays open across later saves. |
| `requested_by` | `uuid` not null | |
| `note` | `text` | What the author wants looked at. |
| `created_at` | `timestamptz` | |
| `resolved_at` | `timestamptz` | Set when the entry publishes, or when the requester withdraws. |

Partial unique index on `entry_id` where `resolved_at is null` — one open request
per entry, so asking twice updates rather than piles up.

### `review_approvals`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` pk | |
| `workspace_id`, `content_type`, `entry_id` | | Denormalised so the queue and the records column need no join to revisions. |
| `revision_id` | `uuid` not null | **What makes an approval expire.** |
| `user_id` | `uuid` not null | |
| `decision` | `text` not null | `approved` \| `changes_requested`. |
| `note` | `text` | Required in practice for `changes_requested`; the API does not force it. |
| `created_at` | `timestamptz` | |

`unique (revision_id, user_id)` — one vote per person per version, changeable by
upsert. Index on `(workspace_id, entry_id)`.

### Why no foreign key to revisions

`content_entry_revisions` is **host-owned**: `content-server` emits no migrations
for it, the host's drizzle config re-exports it into the diff. A plugin cannot
declare an FK into a table whose migration it does not own, so `revision_id` is a
plain `uuid`. The integrity that matters is not referential anyway — a deleted
revision leaves an approval that matches no head, which is exactly the behaviour
wanted.

Workspace deletion is handled by implementing `WorkspacePurger` (three tables,
one purger), and all three go into `workspace-delete-residue.spec.ts`, which
asserts that every table counts zero after a delete.

## The decision

Framework-free, in `protection/domain`. **It cannot be called `canPublish`** —
`content/domain`'s publish gate already exports that name, and two functions
called `canPublish` deciding different halves of the same button is exactly the
confusion ADR-0015 warns about.

```ts
evaluateProtection(input: {
    rule?: ProtectionRule;          // absent → unprotected
    headRevisionId: string;
    headAuthorId: string | null;
    approvals: readonly Approval[];
    actor: { userId: string | null; isAdmin: boolean; isToken: boolean };
}): ProtectionDecision;

type ProtectionDecision =
    | { allowed: true; reason: 'unprotected' | 'satisfied' }
    | { allowed: false; reason: 'token-refused' }
    | {
          allowed: false;
          reason: 'insufficient-approvals';
          required: number;
          given: number;
          stale: number;          // shown struck through, and why the count moved
          bypassable: boolean;    // rule.admin_bypass && actor.isAdmin
      };
```

Counting rules, in order:

1. A token: allowed only when `allow_token_publish`; otherwise `token-refused`,
   regardless of approvals.
2. Approvals with `decision = 'approved'`, on `headRevisionId` — or on any
   revision when `count_stale_approvals` is on.
3. Minus the head author's own, when `require_other_person`.
4. Distinct by `user_id`.
5. `changes_requested` does **not** subtract. It is zero votes plus an
   explanation; a reviewer who wants to block simply does not approve.

`bypassable` is reported, never applied: the decision says a bypass is possible,
the caller must still pass a reason to take it.

## HTTP API

Everything mounts under `/api/protection`. Routes do **not** hang off
`/api/content/...` — a plugin mounting into another plugin's path makes the
prefix ambiguous to read and to guard.

All entry routes take `WorkspaceGuard` and `X-Workspace-Id`.

| Method & path | Guard | In | Out / failures |
| --- | --- | --- | --- |
| `GET /rules` | `protection:manage` | — | Every rule in the workspace. |
| `PUT /rules/:kind/:slug` | `protection:manage` | The six fields | Upsert. `404` if the type is not granted to the workspace — a rule on an ungranted type is meaningless. |
| `DELETE /rules/:kind/:slug` | `protection:manage` | — | `204`. Same as `enabled: false` but leaves no row. |
| `GET /entries/:type/:id` | `content:read` | — | The effective requirement, the approvals (with staleness), the open request. Readable without `protection:manage` — the editor has to render "0 of 2". |
| `POST /entries/:type/:id/request` | `content:update` | `note?` | Opens or updates the request. |
| `DELETE /entries/:type/:id/request` | `content:update` | — | Withdraws it. Only the requester or an administrator. |
| `POST /entries/:type/:id/approve` | `content:approve` | `note?` | Upserts this user's vote on the head. `409` when `require_other_person` and the caller wrote the head. |
| `POST /entries/:type/:id/changes` | `content:approve` | `note` | Same row, `decision = 'changes_requested'`. |
| `DELETE /entries/:type/:id/approve` | `content:approve` | — | Withdraws own vote. |
| `GET /queue` | `content:read` | `?mine=1` | Open requests across every type in the workspace, for the reviewer page. |

### The refusal is 409, not 403

A blocked publish returns **409 Conflict** with
`{ code: 'protection.insufficient_approvals', required, given, bypassable }`.
`403` would be indistinguishable from lacking `content:publish`, and the admin
has to tell those apart to know whether to show "ask an administrator for the
permission" or "ask a colleague for an approval". A token refusal is
`409 protection.token_refused` for the same reason.

Publishing with a bypass is the ordinary publish call plus
`{ bypassReason: string }` — non-empty, trimmed, capped. Sending it without
`admin_bypass`, or without being an administrator, is `403`.

## Permissions, and the role question

Two new keys in `PERMISSIONS`:

- **`content:approve`** — granted to `contributor` and to `admin`. Not to
  `viewer`: approving is an editorial act.
- **`protection:manage`** — administrator only. A rule is configuration, the same
  class as `alarms:manage`.

`seedSystemRoles` **reconciles** the catalogue in both directions on every boot —
it adds new keys, adds the grants the matrix lists, and prunes what code no
longer declares. So both keys reach existing installations by deploying, with no
migration and no manual step.

**No new system role is needed.** The pattern is already established in
`system-roles.ts`: *"An operator who wants deletion held back mints a custom role
without the two keys; the routes gate on the permission, never on the role."*
A deployment that wants a writer who cannot publish mints a custom role without
`content:publish`; one that wants a reviewer who cannot write mints one with
`content:approve` and without `content:update`. Both are operator configuration,
and neither is this feature's business.

## The admin UI

`protection/admin`. **Two** new slots in packages this feature does not own,
everything else contributed into slots that already exist.

### The changes to existing packages

The plan said one. Building it found a second, and the second is the honest
kind: the workspace settings tab strip was hardcoded, so there was no seam to
contribute a tab through. Both follow the same rule — the owning package keeps
rendering, the contribution only says what to render — and both ship with a
test, in the package that owns the slot, that an empty slot changes nothing.

**`ENTRY_PUBLISH_GUARD_SLOT`** (`content-admin`). A contribution returns
`{ blocked, reason, action? }` for the current entry; `EntryActions` keeps
rendering the button. Content owns the button because it already computes the
publish gate's half of its state, and a second component drawing a second button
would drift from the first.

**`WORKSPACE_SETTINGS_TAB_SLOT`** (`workspaces-admin`). A contribution names a
path, a label, an icon, an order and the section to render; the settings page
mounts it as a nested route and the tab strip links to it, between Content and
Danger zone. Danger zone stays last because it is where a workspace is
destroyed, so contributed tabs sort among themselves rather than against the
built-ins.

### Entry editor

- **Header chip** (`ENTRY_HEADER_SLOT`) — "Needs review · 0 of 2", beside the
  status badge and the i18n locale chip.
- **Rail section** (`ENTRY_SIDEBAR_WIDGET_SLOT`) — renders `EntrySidebarSection`,
  not a card of its own; the rail is one flat surface divided by rules and a
  contribution with its own border is the one floating box in it. Lands after
  Publish gate → Details → Revisions, because slot widgets render last.
  - Header action mirrors the publish gate's: `0 of 2` in destructive, `1 of 2`
    in warning, `2 of 2` in success.
  - Each approver with the version they approved. **A stale approval stays
    visible, struck through, naming its version** — a counter that silently rolls
    back after a save is unexplainable otherwise.
  - Actions: *Request review* for the author; *Approve* / *Request changes* for
    anyone else holding `content:approve`.
- **Button states** — disabled with the requirement in its tooltip; enabled and
  ordinary when satisfied; relabelled *Publish anyway* in a warning tone for an
  administrator with bypass. The bypass dialog demands a non-empty reason and
  says, before the click, that it will appear in the activity log.

### Workspace settings

A fifth tab, **Protection**, between Content and Danger zone. Rows come from the
workspace's existing content grants — the list is not maintained separately. Each
row: the type, its state, a *Configure* action opening the rule editor. Read-only
without `protection:manage`, like every other settings tab.

Switching a rule on in a workspace with one member, with `require_other_person`,
warns at that moment — not a week later on the first failed publish.

### Elsewhere

- **Records list** — a review column (`RECORDS_COLUMN_SLOT`, batched per page)
  and a virtual `reviewState` filter field (`RECORDS_FILTER_FIELDS_SLOT`), which
  makes saved views and "Save as rule" work with no extra code.
- **Reviews page** (`WORKSPACE_NAV_SLOT` + `WORKSPACE_ROUTE_SLOT`) — *Waiting on
  me* and *My requests*, across every type, with the age of each request. This is
  how a reviewer learns there is work; until the mail port lands it is the only
  way.
- **Insights card** — open requests, and how many are older than three days.

## Agent surfaces

Three tools in the shared registry, each declaring `surfaces` **explicitly** —
omitting the field in `tools/server` means both, so silence here would hand a
tool to MCP by accident.

| Tool | Surfaces | Requires | What |
| --- | --- | --- | --- |
| `protection_review_status` | copilot, mcp | `content:read` | The requirement, the approvals, who and on which version. |
| `protection_review_diff` | copilot, mcp | `content:read` | What changed between the head revision and the last one this caller approved. The most useful of the three: revisions make the answer exact. |
| `protection_request_review` | copilot, mcp | `content:update` | Opens a request. A write, so it parks for the in-the-moment prompt like any other. |

**There is no approve tool, and no changes-requested tool.** ADR-0017 §6 carries
the argument. The tool descriptions — written for a model, not a person — say so
directly, so a model spends no turns trying.

## What reaches the activity log

Five kinds, in the existing `noun.verb_phrase` shape:

| Kind | When |
| --- | --- |
| `review.requested` | An author asks. |
| `review.approved` | With the revision number, so the trail survives later edits. |
| `review.changes_requested` | With the note. |
| `entry.publish_bypassed` | **The auditor's row.** Actor, rule, reason. |
| `protection.rule_changed` | Enabling, disabling, or lowering the count. Without it the bypass is not a button but a settings tab left open for two minutes. |

Raised as domain events through the outbox in the same transaction as the write,
with a mapper in `activity-server` — a log row appears only if a mapper for the
kind exists there.

## How it meets the rest of the system

| | |
| --- | --- |
| **i18n** | Free, and correct: revisions are already per-locale, so approving the German entry says nothing about the French one. One place needs care — *publish every locale* from the entry menu must report **which** locales are blocked, not refuse opaquely. |
| **API tokens** | Refused by default, per rule. A token holds `content:publish` in the `full` scope and names no person, so allowing it by default would let the rule be escaped by minting a key. |
| **Scheduled publishing** | The rule is evaluated **when the timer fires**, not when the schedule is set. A fired timer has no human, so bypass cannot apply: short of approvals the publication does not happen, and the failure is logged. |
| **transfer** | Open question, deliberately. Import writes through `EntryWriterService`, so it meets the port like everything else — but whether an import may publish into a protected type is a policy call, not a consequence. |
| **copilot** | Publishing was already withheld from every role (ADR-0005 §7); nothing changes. It gains the three read/request tools. |
| **alarms** | Adjacent and must stay separate: alarms flag and never block, protection blocks and never judges content. Merging them is the two-authorities failure ADR-0015 exists to prevent. |
| **segments** | No interaction. Segments decide who may read what is published; protection decides whether it gets published. |

## Configuration

None. No environment variable, no host config, no feature flag: the rule table is
the whole configuration surface, and its empty state is the off state. A plugin
that must be switched on twice — once by the operator and once per workspace —
has the settings screen ADR-0009 deleted.

## Invariants

The first four say the same thing at four altitudes, because "inert until a
rule exists" is a claim about the uninstalled host, the unconfigured install,
the empty slot and the missing row — and only the last of them is about this
package's own data.

- **I-01** With no guard registered at all — a host whose plugin list does not
  name protection — the port resolves to allowed without consulting anything,
  and the publish path is the one that ran before the port existed.
- **I-02** Installed but unconfigured pays nothing: with no rule for the type,
  the guard answers before it reads an approval.
- **I-03** `ENTRY_PUBLISH_GUARD_SLOT` carrying no contribution leaves the
  publish button exactly as the publish gate alone had it.
- **I-04** With no `protection_rules` row for a type, publication behaves byte
  for byte as it does with the plugin uninstalled.
- **I-05** An approval counts only on the entry's head revision, unless
  `count_stale_approvals` is on.
- **I-06** Saving an entry never deletes an approval, and always changes which
  approvals count.
- **I-07** With `require_other_person`, the head revision's author is excluded
  from the count, whoever they are — administrators included.
- **I-08** One user contributes at most one vote per revision.
- **I-09** `changes_requested` never lowers the count below what `approved`
  votes give.
- **I-10** Protection never inspects field values, and never overrides the
  publish gate. A bypass passes protection only.
- **I-11** A bearer token cannot publish a protected type unless
  `allow_token_publish` is on for that type.
- **I-12** No API token scope grants `content:approve`. A token names no person,
  and "no approve tool on any surface" ([ADR-0017](../adr/0017-publication-protection.md) §6)
  buys nothing if minting a key casts the vote the tool may not.
- **I-13** Every successful bypass writes exactly one `entry.publish_bypassed`
  row carrying a non-empty reason.
- **I-14** Disabling a rule or lowering `required_approvals` writes
  `protection.rule_changed`.
- **I-15** `status` takes no value other than `draft` or `published`, and no
  review state is readable through the public API.
- **I-16** Deleting a workspace leaves zero rows in all three tables.
- **I-17** No tool in the registry can record an approval, on any surface.

## Testing checklist

| Action | Expected |
| --- | --- |
| Publish with a rule requiring 2, one approval given | 409, `required: 2, given: 1`; the button was disabled in the admin |
| Approve, save the entry, read the state | Count back to 0, the approval listed as stale with its version |
| `count_stale_approvals` on, same sequence | Count stays 1 |
| Author approves own head with `require_other_person` | 409, and the button is not offered |
| Same author approves, then someone else saves | The approval now counts — the head author changed |
| Publish with a bearer token, `allow_token_publish` off | 409 `protection.token_refused` |
| Bypass with an empty reason | 400; nothing published, nothing logged |
| Bypass by a non-administrator | 403 |
| Bypass while the publish gate fails | 422 from the gate — protection is not reached |
| Publish an entry whose German locale lacks approvals | German refused by name, the others proceed |
| Delete the workspace | All three tables count zero (`workspace-delete-residue.spec.ts`) |
| Offer the tool catalogue to any role | No tool with an approve effect appears |
| Ask `scopePermissions` for either token scope | `content:approve` in neither (`api-token-scope.spec.ts` already lists `full` exhaustively) |
| Boot a host that never registers the plugin, publish | Succeeds; the port resolves to always-allowed |
| Register the plugin, write no rule, publish | Succeeds, and the approvals store is never queried |
| Render the entry editor with nothing in `ENTRY_PUBLISH_GUARD_SLOT` | The button is the publish gate's own state, unchanged — a `content-admin` test, written with the slot |

## What this does not do

- **No workflow.** No stages, no assignment, no transitions, no third status.
- **No reviewer lists.** No assignees, groups or code owners: anyone with
  `content:approve` except the head author. Reviewer lists are roles inside a
  workspace, which membership deliberately does not have.
- **No inline comments.** *Request changes* is one note per version, not a thread
  on a paragraph.
- **It does not protect editing.** Drafts on a protected type are edited freely.
  Publication is protected; saving unfinished work is what drafts are for.
- **It does not cover delete or unpublish.** Only `draft → published`. Extending
  it is a second rule field and a second decision, not a silent widening.

## Phases

1. **The rule works** — ADR accepted, domain, three tables, the port, the routes,
   the two permissions, the guard slot, the rail section, the button states, the
   bypass dialog, the settings tab, the five event kinds.
2. **People use it** — the reviews page, the records column and filter, the
   Insights card, the header chip, the three tools. Mail on review requests
   lands after the mail port.
3. **Seams** — scheduling re-check, the transfer question, the feature page on
   the website and the docs section.
