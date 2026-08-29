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

## The four decisions worth knowing before changing anything here

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
selected is a different thing — an endpoint that receives nothing — and the form
says so beneath the workspace picker rather than silently accepting it.

`allWorkspaces` defaults to **off** and `allEvents` to **on**, and the asymmetry
is deliberate: reaching across every workspace should be something someone
chose, while an endpoint subscribed to no events is not a safer endpoint, it is
a broken one.

### 3. The delivery log polls itself, and stops

`useWebhookDeliveries` sets `refetchInterval` only while a row on the page is
`pending`, `delivering` or `failed`. A queued delivery becomes a delivered one
without anybody pressing refresh — and once every row is terminal there is
nothing left to watch, so the polling stops rather than running for as long as
the tab is open.

Redelivery invalidates `webhooksKeys.deliveriesOf(endpointId)`, not the root:
the log is the one actively-polled query here, and invalidating everything would
refetch every other endpoint's pages for a change that cannot affect them.

### 4. A refused URL is shown in the form, not as a toast

The server answers `422` with a message written for whoever typed the URL. The
page puts it in the dialog and keeps the dialog open, so it can be corrected in
place. A generic "couldn't create the webhook" would throw that away.

## Layout

```
src/lib/
  utils/webhooksPlugin/           the AdminPlugin factory — routes + nav slot
  domain/types/                   the view models
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
