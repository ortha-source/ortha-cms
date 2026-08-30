# @orthacms/webhooks-admin

The **webhooks admin plugin** — the global surface for configuring where this
CMS sends content-change notifications, and for seeing whether they arrived.

Layout: **layered (ADR-0003)** — `domain / application / infrastructure /
presentation`, with a gateway port over `apiClient`.

## What it is

Two routes in the sidebar's `directory` group, beside API tokens:

- `/webhooks` — the endpoint list, the create dialog, the one-time secret reveal.
- `/webhooks/:id` — one endpoint, in two tabs: **Deliveries** (the default) and
  **Settings**.

Deliveries is the default tab on purpose. "What does this send?" is asked once,
when the endpoint is created; "did it arrive?" is asked every time afterwards.

## The five decisions worth knowing before changing anything here

### 1. Both permissions are administrator-only

`webhooks:read` gates the nav row, both pages and every query; `webhooks:manage`
gates every write control. Unlike `alarms:read` or `segments:read` — which
describe content an editor is already working on — even _reading_ this is
withheld from contributors, because an endpoint reaches across every workspace
it names and its rows hold a signing secret.

### 2. "All …" is a toggle, not an empty picker

Each of the three filters is an "All …" checkbox over a multi-select. Turning one
on sends **no value** for that filter, which is how the server spells
"everything, including what does not exist yet". Leaving it off with nothing
selected is a different thing for workspaces — an endpoint that receives nothing
— and the form says so beneath the workspace picker rather than silently
accepting it.

`allWorkspaces` defaults to **off** and `allEvents` / `allContentTypes` to
**on**, and the asymmetry is deliberate: reaching across every workspace should
be something someone chose, while an endpoint subscribed to no events is not a
safer endpoint, it is a broken one.

### 3. The content-type picker is scoped by the workspace filter

The section does not exist until the workspace question is answered — "All
workspaces", or at least one workspace chosen. Which types are on offer is a
question about the workspaces, and a delivery needs **both** halves of the
filter to match, so a type none of the chosen workspaces was granted could only
ever produce silence. `grantedContentTypes()` therefore narrows the registry to
the union of those workspaces' `workspace_content` grants, which ride along on
`GET /api/workspaces` (the list the workspace picker already fetches — no second
request). Two cases fall back to the whole registry rather than to nothing:
`allWorkspaces` (workspaces created later may be granted anything) and no
workspace chosen at all (nothing to narrow by — the form hides the picker
instead of guessing).

An endpoint that already carries a type filter keeps its controls visible even
with no workspace chosen: hiding them would leave a saved subscription
invisible and uneditable.

### 3b. …and it is open, not closed

Its options come from content's registry (`GET /api/content-schema`, via
`useContentTypeOptions`), but a name that is not in them is still selectable and
still saved — a type is code, and an endpoint is routinely configured before the
type it subscribes to exists. So:

- `contentTypeChoices()` appends any **selected** name the registry does not
  know, labelled as unrecognised. Dropping it would widen the endpoint from one
  type to every type on the next save, which is the inversion this module exists
  to prevent.
- Names can be typed in as well as picked. `parseContentTypeNames()` splits on
  commas and whitespace (this field gets pasted into) and changes nothing else —
  not even case, since the server matches the string as given.
- The catalogue is gated on `content:read`, not on a webhooks key. A **403 is
  answered with an empty catalogue rather than an error**, because free entry
  still works without it.

### 4. The delivery log polls itself, and stops

`useWebhookDeliveries` sets `refetchInterval` only while a row on the page is
`pending`, `delivering` or `failed`. A queued delivery becomes a delivered one
without anybody pressing refresh — and once every row is terminal there is
nothing left to watch, so the polling stops rather than running for as long as
the tab is open.

Redelivery invalidates `webhooksKeys.deliveriesOf(endpointId)`, not the root:
the log is the one actively-polled query here, and invalidating everything would
refetch every other endpoint's pages for a change that cannot affect them.

### 5. A refused URL is shown in the form, not as a toast

The server answers `422` with a message written for whoever typed the URL. The
page puts it in the dialog and keeps the dialog open, so it can be corrected in
place. A generic "couldn't create the webhook" would throw that away.

## Layout

```
src/lib/
  utils/webhooksPlugin/           the AdminPlugin factory — routes + nav slot
  domain/types/                   the view models
  domain/contentTypeChoices/      picker options + typed-in names (pure)
  infrastructure/
    webhookGateway/               the port
    httpWebhookGateway/           the only place apiClient is used
    webhookMapper/                wire → view, the anti-corruption layer
    webhooksKeys/                 query keys; deliveries hang off their endpoint
  application/                    TanStack hooks, one folder per concern
  presentation/
    pages/                        flat — WebhooksPage, WebhookDetailPage
    components/                   nested by consumer
```

## Commands

- `npx nx run-many -t typecheck lint -p @orthacms/webhooks-admin`
- `npx nx serve admin`
