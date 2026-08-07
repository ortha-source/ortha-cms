# @ortha-cms/copilot-admin

The admin-side copilot plugin — the chat panel's future home.

**Phase 0 contributes nothing.** `CopilotPlugin()` returns `{ name: 'copilot' }`:
no routes, no slots, no components, no data layer. It is registered in
`apps/admin/src/main.tsx` so the host's plugin list, the TypeScript project
references and the package graph are already in place when the panel lands —
making that a UI change rather than a wiring change.

## What lands here next

Phase 1 of [`docs/design/copilot.md`](../../../docs/design/copilot.md): the
chat panel (a right-hand sheet in the workspace shell, opened from the sidebar
footer or `⌘J`), the streaming transport, and the tool-step disclosure UI.

Two things that phase has to solve, worth knowing before starting:

- **The shared `apiClient` is axios, and axios cannot stream in the browser.**
  The copilot needs a `fetch` transport that replicates its credentials and
  `X-Workspace-Id` behaviour — not a change to `apiClient` itself.
- **`admin-e2e` mocks `/api` with `page.route`**, which will have to fulfil an
  event-stream body for the panel's tests.

## When it grows

Follow the `admin-plugin` skill and
[`packages/bootstrap/admin/AGENTS.md`](../../bootstrap/admin/AGENTS.md): the
per-module `<name>/index.tsx` folder layout (already used for
`presentation/copilotPlugin`), lazy code-split routes, per-hook data layer,
`useHasPermission` gating on `copilot:use`, and co-located `defineMessages`.

## Commands

- `npx nx typecheck @ortha-cms/copilot-admin`
- `npx nx lint @ortha-cms/copilot-admin`
