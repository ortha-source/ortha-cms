# @ortha-cms/copilot-admin

The admin-side copilot plugin — the chat panel.

> **The product is called Ortha AI; this package is called `copilot`.** Every
> `defaultMessage` a user reads says "Ortha AI"; the message **ids**, component
> names, routes and permission keys all keep `copilot`. Deliberate — see the
> naming note at the top of
> [`docs/design/copilot.md`](../../../docs/design/copilot.md). When you add a
> string, follow the same split.

**Phase 1 contributes one thing: an entry point.** `CopilotPlugin()` fills the
shell's `SIDEBAR_FOOTER_SLOT` with a launcher that opens the panel (or `⌘J`) and
contributes **no routes** — the panel is a sheet over whatever page you are on,
which is the point of it being a persistent surface rather than a destination.

## Layout

```
application/
  runStream.ts             # the fetch-based SSE transport
  chatReducer.ts           # pure reducer folding run events into a transcript
  useCopilotChat.ts        # owns the transcript, drives + cancels the stream
  useConversations.ts      # thread list (query)
  useConversation.ts       # open one thread (mutation) + block→UI mapping
  useCopilotModels.ts      # the model catalogue + choice-key helpers
  useWorkspaceIdFromRoute.ts
presentation/
  copilotPlugin/           # the plugin object
  CopilotLauncher/         # sidebar-footer button + ⌘J, permission-gated
  CopilotPanel/            # the sheet
  MessageList/  ToolStep/  Composer/  ModelPicker/  ConversationPicker/
  Markdown/                # small local renderer (see below)
```

## Four decisions worth knowing

- **The transport is `fetch`, not the shared `apiClient`.** Axios cannot stream a
  response in the browser. `streamRun` replicates the two behaviours that matter
  — `credentials: 'include'` for the httpOnly session cookie, and the
  `X-Workspace-Id` header — rather than changing `apiClient`. It is SSE over
  **POST**, because the turn has a body and `EventSource` can only issue a
  bodyless GET. (Verified to stream unbuffered through the Vite dev proxy.)
- **`useCurrentWorkspace()` is unusable here, and fails loudly.**
  `CurrentWorkspaceProvider` wraps only the workspace shell's *inset content*;
  the app sidebar — where the launcher lives — renders **outside** it, and the
  hook **throws** there rather than returning null, taking the whole admin down
  on every page. `useWorkspaceIdFromRoute` reads the route param instead; the
  sidebar is still inside the router. The id only ever becomes
  `X-Workspace-Id`, which `WorkspaceGuard` validates for shape and membership,
  so a route-derived id is no more trusted than a context-derived one.
- **A pure reducer, not `setState` in the stream loop.** A `text-delta` arrives
  dozens of times per answer and must append to the *current* last message, not
  a stale closure's. Keeping it pure also makes the interesting cases — a step
  resolving, a run erroring mid-answer — unit-testable without a socket.
- **Two triggers, one panel.** A sidebar-footer row (which carries the `⌘J`
  hint, so the shortcut is discoverable) and a floating button in the corner the
  panel opens from. Focus returns to **whichever** trigger was used. The
  floating button fades out while the panel is open — but stays mounted, so
  focus has somewhere to return to, and takes `tabIndex={-1}` + `aria-hidden`
  meanwhile, because an invisible-but-tabbable button is a trap in a non-modal
  surface where Tab really does reach it.
- **The panel is a non-modal docked window, not a `Sheet`.** A modal drawer
  dims the page, traps focus and blocks every control behind it — but the useful
  thing to do with an answer is act on it, which would mean closing the
  conversation first. Consequences, all deliberate: no focus trap (Tab leaves
  the panel, because the page is live), no overlay, focus still *managed*
  (composer on open, `returnFocusRef` on close), Escape closes. Minimizing hides
  the body but keeps it **mounted**, so a run in flight keeps streaming rather
  than being silently cancelled.
- **Markdown is rendered by a small local component**, not a dependency. It
  covers what an assistant actually emits — including **pipe tables**, which was
  the first gap real use hit and hit hard: without them a content-type table
  fell through to the paragraph branch, which joins lines with a space and
  collapsed the whole thing into one run-on line. The parser is split into
  `parseBlocks.ts` so those cases are unit-tested without rendering. The
  load-bearing property is that it builds **React elements and never touches
  `dangerouslySetInnerHTML`**, so escaping is automatic — an answer is derived
  from content the model read, which is user-authored and
  attacker-influenceable. Link hrefs are additionally scheme-allow-listed, since
  escaping does not save you from `[click](javascript:…)`. **If a second gap
  like the table one turns up, stop growing this and take `react-markdown`** —
  it is a drop-in replacement for the component.

## Motion

Two traps, both hit while building this:

- **`animate-in` / `fade-in-0` / `zoom-in-95` do nothing in this workspace.**
  Those are `tailwindcss-animate` utilities and it is deliberately not
  installed, so the classes shadcn ships generate no CSS at all — see the note
  atop `packages/design-system/src/styles.css`. The panel and the floating
  button use plain **transitions** instead, which is also the safer primitive:
  with motion disabled the element simply lands on its visible state, where a
  keyframe animation can leave it stuck invisible.
- **Transition `translate` and `scale`, not `transform`.** Tailwind v4 emits
  those as standalone CSS properties rather than folding them into the
  `transform` shorthand, so `transition-[opacity,transform]` fades the opacity
  while the movement snaps. It looks subtly broken and reads as a timing bug.

The panel keeps a `rendered`/`visible` state pair so the exit transition can
play before unmounting — and it does still unmount, which is what ends the run.
Both elements carry `motion-reduce:transition-none`.

## Model selection

The picker renders `GET /api/copilot/models` (`ModelRegistry.catalogue()`), and
the choice is **per turn, not per thread** — a conversation can start on a cheap
model and escalate. "Default" is a real option meaning "whatever the host's
resolver picks", which can differ per run; it is not a synonym for today's
default provider. The picker hides itself when the deployment offers one
backend.

## Conventions

Follow the `admin-plugin` skill and
[`packages/bootstrap/admin/AGENTS.md`](../../bootstrap/admin/AGENTS.md): the
per-module `<name>/index.tsx` folder layout, the per-hook data layer,
`useHasPermission` gating on `copilot:use` (fail-closed, so a user whose
permissions haven't loaded sees nothing rather than a button that 403s), and
co-located `defineMessages`.

## Testing

`chatReducer` and the model-choice key helpers are unit-tested (`nx test`) —
this is the first admin package with a jest config, `testEnvironment: 'node'`
because the tested code is pure. **The panel has no browser-level coverage yet**:
`admin-e2e` mocks `/api` with `page.route` and cannot currently fulfil an
event-stream body. That gap is tracked in `docs/design/copilot.md` §8.

## Commands

- `npx nx typecheck @ortha-cms/copilot-admin`
- `npx nx lint @ortha-cms/copilot-admin`
- `npx nx test @ortha-cms/copilot-admin`
