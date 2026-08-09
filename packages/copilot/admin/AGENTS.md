# @ortha-cms/copilot-admin

The admin-side copilot plugin — the chat panel.

> **The product is called Ortha AI; this package is called `copilot`.** Every
> `defaultMessage` a user reads says "Ortha AI"; the message **ids**, component
> names, routes and permission keys all keep `copilot`. Deliberate — see the
> naming note at the top of
> [`docs/design/copilot.md`](../../../docs/design/copilot.md). When you add a
> string, follow the same split.

`CopilotPlugin()` fills the shell's `SIDEBAR_FOOTER_SLOT`, but renders **nothing
into the sidebar** — the slot is only what mounts the component, which portals
the dock and its windows to `<body>`. A chat is a docked window over whatever
page you are on, which is the point of it being a persistent surface rather than
a destination, and there can be **several at once**, listed in a bar along the
bottom right.

It contributes **no routes and no nav entry**. It used to contribute one, for
the workspace's auto-apply policy;
[ADR-0009](../../../docs/adr/0009-copilot-applies-directly.md) deleted the
policy along with the screen, the table, the two routes and `copilot:configure`.
What the copilot may do is what the caller's role may do, so there is nothing
left to configure per workspace.

## Layout

```
application/
  runStream.ts             # the fetch-based SSE transport
  chatReducer.ts           # pure reducer folding run events into a transcript
  useCopilotChat.ts        # owns the transcript, drives + cancels the stream
  useConversations.ts      # thread list (query)
  useConversation.ts       # open one thread (mutation) + block→UI mapping
  useDecideToolPermission.ts # answer a parked run (mutation)
  useCopilotModels.ts      # the model catalogue + choice-key helpers
  readRouteContext.ts      # pure URL → surface context
  useRouteContext.ts       # the hook over it
  sessions.ts              # pure reducer over the set of open chats (tested)
  useCopilotSessions.ts    # the hook over it: ids + stable callbacks
  panelFrame.ts            # pure move/resize/clamp arithmetic (unit-tested)
  usePanelFrame.ts         # the hook over it: pointer capture + localStorage
presentation/
  copilotPlugin/           # the plugin object
  CopilotLauncher/         # sidebar row + ⌘J + the dock, permission-gated
  CopilotDock/             # the bottom bar: one pill per chat, + new chat
  CopilotSession/          # one always-mounted chat; owns useCopilotChat
  CopilotPanel/            # the window a visible chat renders in
  PanelResizeHandles/      # the eight grab strips
  MessageList/             # the transcript
  ToolStep/                # one call, as a sentence; `labels.ts` holds both tenses
  Composer/  ModelPicker/  ConversationPicker/
  ContextChip/             # what context is attached to the next turn
  PermissionPrompt/        # "may I?" — the inline gate before a write runs
  ProposalCard/            # the receipt for a change, and its diff
  Markdown/                # small local renderer (see below)
```

## Decisions worth knowing

- **The transport is `fetch`, not the shared `apiClient`.** Axios cannot stream a
  response in the browser. `streamRun` replicates the two behaviours that matter
  — `credentials: 'include'` for the httpOnly session cookie, and the
  `X-Workspace-Id` header — rather than changing `apiClient`. It is SSE over
  **POST**, because the turn has a body and `EventSource` can only issue a
  bodyless GET. (Verified to stream unbuffered through the Vite dev proxy.)
- **`useCurrentWorkspace()` is unusable here, and fails loudly.**
  `CurrentWorkspaceProvider` wraps only the workspace shell's _inset content_;
  the app sidebar — where the launcher lives — renders **outside** it, and the
  hook **throws** there rather than returning null, taking the whole admin down
  on every page. `useRouteContext` reads the URL instead; the
  sidebar is still inside the router. The id only ever becomes
  `X-Workspace-Id`, which `WorkspaceGuard` validates for shape and membership,
  so a route-derived id is no more trusted than a context-derived one.
- **A pure reducer, not `setState` in the stream loop.** A `text-delta` arrives
  dozens of times per answer and must append to the _current_ last message, not
  a stale closure's. Keeping it pure also makes the interesting cases — a step
  resolving, a run erroring mid-answer — unit-testable without a socket.
- **The dock is the only entry point.** It replaced the floating button, and
  then the sidebar row went too. A round button could only ever mean "the
  panel", singular; a sidebar row duplicated what the dock already says while
  spending a permanent navigation slot on it. With no chats open the dock _is_ a
  labelled Ortha AI button in the corner — carrying the `⌘J` hint, which is
  where the shortcut is now discoverable — and as soon as there are chats it
  becomes the bar listing them.
- **The window is non-modal, not a `Sheet`.** A modal drawer
  dims the page, traps focus and blocks every control behind it — but the useful
  thing to do with an answer is act on it, which would mean closing the
  conversation first. Consequences, all deliberate: no focus trap (Tab leaves
  the panel, because the page is live), no overlay, focus still _managed_
  (composer on open, the dock's new-chat button when a window closes).
  **Escape collapses to the dock rather than closing** — discarding a chat and
  cancelling its run is too much to hang off the key people press to dismiss
  things, and the chat keeps streaming as a pill.
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

## Several chats at once

Ask three things, go back to work, come back when the dock says one finished.
That is the feature; everything below is what it costs.

- **`useCopilotChat` lives in `CopilotSession`, not in `CopilotPanel`.** This is
  the load-bearing bit. The panel unmounts when its chat collapses to the dock,
  and a hook inside an unmounted panel takes its `AbortController` cleanup with
  it — so minimizing used to be, and would silently become again, a disguised
  cancel. Lifting the hook one level is the whole mechanism. **Do not move it
  back into the panel.**
- **Every chat stays mounted for as long as its pill exists.** Closing a pill is
  what cancels a run; collapsing one never does.
- **The window cap minimizes rather than refuses.** Three windows fit side by
  side on a 1440px screen without covering the content the chat is _about_ —
  which is why the panel is non-modal in the first place. A fourth minimizes the
  oldest visible chat, which keeps running. Refusing would be the wrong trade:
  the user asked for another chat, and the one they stopped looking at is the
  cheapest thing to give up.
- **Two markers, and they mean different things.** `unread` — a run finished —
  is edge-triggered off `busy` going true→false and only ever set on a chat that
  is **off screen**. `awaiting` — the run is parked on a permission prompt — is
  live **state**, set even while visible, and outranks `unread` on the pill:
  a chat blocked on a question is the one to open first.
- **The `awaiting` action returns the same array when nothing changed**, so
  `useReducer` bails out. That is load-bearing: it is reported from an effect
  whose callback is a fresh closure each render, and an action that always
  allocated produced "Maximum update depth exceeded" — found by driving it in a
  browser, not by reading it.
- The `unread` marker is edge-triggered off `busy` going true→false. Watching the transcript
  instead would fire on the first `text-delta`, i.e. before there is anything to
  come back and read; badging the window the user is already reading trains them
  to ignore the badge that means something.
- **The marker is in the pill's accessible name, not only in the dot.** A
  colour-only signal is no signal, and this one is the entire point of the
  feature.
- **An untitled pill is "Untitled chat", never "New chat".** That is the name of
  the button beside it, and two controls in one toolbar answering to the same
  name is ambiguous by voice and in a screen reader's control list. (Caught by
  the browser harness, not by review.)
- **Reopening a thread focuses the window already on it.** Two windows on one
  `conversationId` would hold two transcripts that immediately disagree — and
  the match is on the id, so two _unsaved_ chats (both `null`) stay separate.
- **A window's remembered geometry is keyed by slot, not by chat.** A chat is
  ephemeral; "the leftmost window" is a place on the screen the user arranged.
  `usePanelFrame` reads its key through a ref so a window changing slot cannot
  write its geometry under the old slot's key and swap two windows' positions.

## Asking before a write

A write tool the thread has not already allowed parks the run, and the prompt
renders **in the transcript** — not as a modal. The panel is non-modal on
purpose (you act on answers while reading them), and a dialog demanding an
answer would block the very page you need in order to decide, often the entry
the change is about.

- **Three buttons, no "always".** Once / this chat / don't allow. "For this
  chat" is the escape hatch, and having it _in the prompt_ is the whole
  difference from the settings page ADR-0009 deleted — you decide where you
  already have the context, not in advance on another screen.
- **A 404 from the answer is expected traffic**, not a bug: the run's five-minute
  timeout fired, or it is parked on another instance. The prompt then **keeps its
  buttons** and says the answer did not land — the run might still be parked, and
  taking the controls away would strand it.
- **A `tool-result` for a parked call retires its prompt.** The server timing
  out, or another window answering, both end the wait without this client having
  clicked; live buttons that answer nothing are worse than no buttons.
- **"Waiting for you" is session _state_, not an `unread` event** — see the dock
  notes above. A chat asking a question stays asking, so an edge-triggered
  marker missed the ordinary case of parking while visible and being collapsed
  afterwards. That miss was hidden behind an infinite render loop; both are
  fixed by the same change.

## The step list reads as a log

`ToolStep` shows a **phrase in two tenses** — "Searching content…" while it
runs, "Searched content · 12 results" once it has — from `ToolStep/labels.ts`,
keyed by tool name.

It used to show the raw `admin_content_search` beside a separate "Running…".
That is a pending state that technically existed and told nobody anything: a
tool that takes 20ms flashes past, so what a user saw was a list of snake_case
function names appearing already-finished. Two tenses rather than one string
with a spinner is the point — "is happening" and "happened" are different
sentences, and a run that made six calls should read back as six of them.

- **The identifier is still there, one click away**, as a payload row in the
  expanded panel: someone debugging wants it and nobody else has to read it.
- **An unknown tool degrades, it does not blank.** `humanizeToolName` turns
  `mcp.acme.fetch_orders` into "Fetch orders" — the connector namespace is
  plumbing this CMS imposes (ADR-0005 §8), not part of the tool's own name. It
  is deliberately **not** translated: there is no message to translate for an
  identifier a third party chose, and minting an id per unknown tool would put
  untranslated English in the catalogue under a key nothing resolves.
- **"Thinking…" also shows between steps**, not only before the first one. The
  old condition bailed as soon as a step existed, so a turn that searched and
  then thought for three seconds showed a finished step and nothing else — the
  answer looked stuck. It stands down while a step is running, since the step
  has its own spinner.
- **A failed apply now draws as a failed step.** The `tool-result` event carried
  `ok: true` with `summary: 'failed'` — a green tick beside the word "failed".
  The block the _model_ gets stays a normal result whose text says NOT applied,
  because that is a receipt to report rather than an error to recover from.

## Changes the copilot makes

A `propose` tool's change arrives as its **own** run event, after the tool
result the same call produced. The two answer different questions — the tool
result is what the _model_ was told, the proposal event is what the _human_ is
being shown — so the step list renders from one and the card from the other.

**The card is a receipt, not a decision.** Since ADR-0009 the write has already
happened by the time it renders, so every word on it is past tense and it has no
buttons. That inverts what it is guarding against: it used to exist to stop a
user reading "drafted" as "done", and now exists because it is the _only_ place
they learn their content changed at all.

- **The card lives in the transcript**, attached to the turn that produced it and
  rendered _after_ the prose. A change is part of an answer ("here is what I
  changed"), and a result above its own explanation is a result with no account
  of itself.
- **`pending` means the apply failed.** Nothing waits any more, so the card
  reads that status as a failure: a destructive badge, "Not saved", and the
  server's own reason. It falls back to a generic line when a reopened row
  carries no message — keyed off the **status**, never off `error` being
  present, or an older row would render its diff as though the change had landed.
- **Reopening a thread reattaches the cards.** `useOpenConversation` fetches the
  transcript and `GET /copilot/proposals?conversationId=` concurrently and joins
  them on `toolCallId`, which is why the server stores it. The failure reason
  comes back with them.
- Proposed values render as **text**, never markup — same rule as the tool step's
  payload, and for a stronger reason: this card is what tells a human what was
  written to their content.

## The panel is portalled to `<body>` — and must stay that way

This component is contributed to the **sidebar's footer slot**, so without a
portal the fixed-position chrome is a DOM _descendant of the sidebar_ and
inherits its styling. That is not hypothetical: the sidebar sets
`text-sidebar-foreground` (a near-white, for its dark background), so the panel
rendered near-white text on its own white surface at **2.86:1** — well under the
4.5:1 WCAG AA requires, and the first thing anyone using it complained about.

`createPortal(…, document.body)` fixes the whole class of problem (colour, font,
letter-spacing) rather than the one symptom, and stops `position: fixed` ever
being trapped by a transform on an ancestor. React context flows through
portals, so the permission and workspace hooks are unaffected.

The panel additionally states `text-foreground` on its own root: it paints its
own surface, so it should own the colour that goes on it rather than inheriting
one. Measured after the fix: **17.67:1**.

## Surface context

Every turn carries where the user is — workspace, content type, entry, locale —
so the model can resolve "this entry" and "here". It comes from the **URL**
(`readRouteContext`, pure and unit-tested; `useRouteContext` feeds it
`useLocation()`), for the same reason the workspace id does: the launcher lives
in the sidebar, outside `CurrentWorkspaceProvider`, and anything the entry editor
exposed through context would be equally out of reach.

It is **opt-in**: a `+ Add context` button attaches the current page, and the
chip has an `×`. Attaching automatically was the first version and it was wrong
— every question looked like it was about whatever page happened to be open, so
asking "how many authors are there?" from the Articles list told the model you
were looking at articles. The attached value is a **snapshot**, not a live
mirror of the URL; navigating re-offers the button so a stale one can be
replaced without removing it first.

Two things that matter:

- **`new` and `trash` are not entry ids.** They sit in the `:entryId` slot on
  the create form and the trash view. Sending `entryId: "new"` would have the
  model confidently discuss an entry that does not exist.
- **The attached context is shown** (`ContextChip`, above the composer). Context
  attached invisibly is context the user cannot correct when it is wrong. The
  design's turn anatomy asks for it too: "Your message, plus where you are" (§2).

None of it is an authority claim. `workspaceId` becomes `X-Workspace-Id`, which
`WorkspaceGuard` validates; `contentType`/`entryId` reach the model as prompt
text, and any tool call made with them is re-checked against the workspace's
grants. A hand-typed URL gets a user nothing they didn't already have.

## Errors: alert, warning, toast

Three presentations, chosen by what the user can actually see and do:

- **A failed turn → `Alert variant="destructive"` in the transcript.** It is the
  record: it stays with the turn it belongs to and survives scrolling. Streamed
  text already received is kept above it — a partial answer is part of what
  happened.
- **A truncated run → `Alert variant="warning"`.** A ceiling is not an error;
  the answer above is real, just cut short. This used to be muted 12px text
  under the answer, which is exactly where "this is incomplete" goes unread. A
  deliberate cancel is neither, and gets a quiet line instead of a banner
  telling the user about their own action.
- **A system condition → `toast.error`, but only while minimized.** The toast
  exists to reach someone who _cannot see_ the alert, and the only such state is
  a minimized panel (a run keeps streaming while it is). Toasting with the panel
  open is worse than useless: the host mounts `Toaster` bottom-right, exactly
  where the panel sits, so it covers the composer to announce something already
  on screen a few pixels above.

`describe()` classifies the throw: an abort is the user's Stop, a
`CopilotRunError` carries the server's own message (with 401 reworded — "your
session has expired" beats "Unauthorized"), and a bare `TypeError` from `fetch`
means the host was unreachable. Only the last two are `systemic`.

**Read panel state through a ref, not the captured value.** `send`'s async
closure is created when the message is sent, but the failure it handles can land
seconds later, by which time the panel may have been minimized — which is the
case the toast is for. Capturing would decide on the state at Enter.

## Moving and resizing

The panel is a window: drag the header to move it, drag any of the eight edge
strips to resize it. Four things about how that is built are load-bearing.

- **A frame is `null` until the user places one.** The docked / expanded /
  minimized geometry stays in CSS, so the panel opens correctly on a viewport it
  has never been opened in, and `left`/`top` remembered from a 4K monitor can
  never be what positions it on a laptop. `usePanelFrame` only takes over
  positioning once someone actually drags, and the first drag **measures**
  `getBoundingClientRect()` so the window does not jump as the gesture starts.
- **Expand and Shrink clear the placement.** They are the way out of a bad drag,
  and the header already has them. Nothing else clears it: the frame survives
  close/reopen and reload (`localStorage`), which is the point of being able to
  move it. The button reads its label off the _preset_, not off `size` — "Shrink"
  on a window the user has just resized to 400px is nonsense.
- **The arithmetic is pure and in `panelFrame.ts`**, because the interesting
  cases are all arithmetic: the whole panel stays on screen (a dragged-off panel
  is a lost panel — there is no other affordance for retrieving it), a saved
  frame on a smaller monitor **slides in rather than shrinking**, and dragging
  the west or north edge past the minimum stops that edge dead instead of towing
  the panel across the screen. That last one is the bug the spec exists for:
  clamping the width _after_ moving `x` moves the whole window.
- **Pointer capture, and no `preventDefault()`.** Capture keeps the moves coming
  when the pointer outruns a 6px strip, and guarantees the release arrives.
  `preventDefault` on the pointerdown would also swallow the focus a mousedown
  gives the resize handle — and that focus is the whole of its keyboard support
  — so text selection is suppressed with `select-none` on the panel instead.

Keyboard: seven strips are pointer-only and `aria-hidden`, because eight
focusable splitters would add eight tab stops to a non-modal surface a keyboard
user is passing _through_. The two that are real controls are the header grip
(arrow keys move, `Shift` for larger steps) and the north-west corner (arrow
keys resize) — the panel's home is bottom-right, so up and left is the direction
that has somewhere to go.

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

`chatReducer`, the model-choice key helpers, `panelFrame` and `sessions` are
unit-tested (`nx test`) — this is the first admin package with a jest config,
`testEnvironment: 'node'` because the tested code is pure. Anything that has to
be got exactly right about the window's geometry belongs in `panelFrame.ts` for
that reason; `usePanelFrame` should stay thin enough to be obviously correct.
The dock and the windows were driven in a real Chromium against a harness of
the actual components — tiling, the cap, titles, the marker's true _and_ false
positives, toggling, closing, drag persistence, Escape, and axe — but **that
harness is not checked in and does not run in CI**. **The panel still has no
`admin-e2e` coverage**:
`admin-e2e` mocks `/api` with `page.route` and cannot currently fulfil an
event-stream body. That gap is tracked in `docs/design/copilot.md` §8.

## Commands

- `npx nx typecheck @ortha-cms/copilot-admin`
- `npx nx lint @ortha-cms/copilot-admin`
- `npx nx test @ortha-cms/copilot-admin`
