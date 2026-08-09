# @ortha-cms/copilot-admin

The admin-side copilot plugin — the chat panel.

> **The product is called Ortha AI; this package is called `copilot`.** Every
> `defaultMessage` a user reads says "Ortha AI"; the message **ids**, component
> names, routes and permission keys all keep `copilot`. Deliberate — see the
> naming note at the top of
> [`docs/design/copilot.md`](../../../docs/design/copilot.md). When you add a
> string, follow the same split.

`CopilotPlugin()` fills the shell's `SIDEBAR_FOOTER_SLOT` with a launcher that
opens the panel (or `⌘J`) — the panel is a docked window over whatever page you
are on, which is the point of it being a persistent surface rather than a
destination.

It contributes exactly **one route**, and the exception proves the rule: the
workspace's auto-apply policy (ADR-0005 §6) _is_ a destination — configuration,
per workspace, read rarely by one person rather than constantly by everyone. Its
nav entry carries `permission: 'copilot:configure'`, so an editor never sees a
link to a page that would 403; the page gates itself too, because a nav entry is
a courtesy and not a boundary.

That page is **not a permission screen**, and it says so on itself now: people
read a screen of unticked checkboxes as a list of things they are not allowed to
do and conclude the copilot is crippled. Every tool listed is one the role
_already_ allows; what the page decides is which of them stop pausing for
review. Its "Tick all" is a shortcut over the tools **on screen**, not a
wildcard — what is saved is their names, so a tool that ships next release
arrives asking for approval like any other, which is the property ADR-0005 §6 is
protecting.

## Layout

```
application/
  runStream.ts             # the fetch-based SSE transport
  chatReducer.ts           # pure reducer folding run events into a transcript
  useCopilotChat.ts        # owns the transcript, drives + cancels the stream
  useConversations.ts      # thread list (query)
  useConversation.ts       # open one thread (mutation) + block→UI mapping
  useCopilotModels.ts      # the model catalogue + choice-key helpers
  useDecideProposal.ts     # accept / reject one proposal (mutation)
  useCopilotPolicy.ts      # the workspace's auto-apply opt-ins (query + mutation)
  readRouteContext.ts      # pure URL → surface context
  useRouteContext.ts       # the hook over it
  panelFrame.ts            # pure move/resize/clamp arithmetic (unit-tested)
  usePanelFrame.ts         # the hook over it: pointer capture + localStorage
presentation/
  copilotPlugin/           # the plugin object
  CopilotLauncher/         # sidebar row + floating button + ⌘J, permission-gated
  CopilotPanel/            # the docked window
  PanelResizeHandles/      # the eight grab strips
  MessageList/  ToolStep/  Composer/  ModelPicker/  ConversationPicker/
  ContextChip/             # what context is attached to the next turn
  ProposalCard/            # a proposed change, its diff, and the two buttons
  PendingProposals/        # decide every pending change at once
  Markdown/                # small local renderer (see below)
pages/
  CopilotSettingsPage/     # the auto-apply policy, `copilot:configure`
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
  the panel, because the page is live), no overlay, focus still _managed_
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

## Proposals

A `propose` tool's change arrives as its **own** run event, after the tool
result the same call produced. The two answer different questions — the tool
result is what the _model_ was told, the proposal is what the _human_ is being
asked to decide — so the step list renders from one and the card from the other.

- **The card lives in the transcript**, attached to the turn that produced it and
  rendered _after_ the prose. A proposal is part of an answer ("here is what I
  would change"), and a card asking for a decision above its own reasoning asks
  the user to decide first and read second. A separate review queue elsewhere
  would make the reply refer to something off-screen.
- **Its most important job is being unmistakable about what has not happened.** A
  pending card says "Nothing has been saved yet" in words, not only by having
  buttons; an applied one says so and drops them.
- **"You applied this" and "this was applied for you" are different sentences**,
  so the card distinguishes them. The server records the same `decidedBy` either
  way — auto-apply acts as the user whose run produced the change — so the only
  signal is that an auto-applied proposal _arrives already accepted_, which the
  reducer stamps as `autoApplied` at that moment.
- **Decisions are found by id across the whole transcript**, not assumed onto the
  last turn: deciding a card three answers up is the ordinary case.
- **A failed decision keeps the card decidable** and shows the server's own
  message. The four statuses mean different things to the person clicking — 409
  someone got there first, 403 you may not, 422 it could not be applied and is
  still pending, 404 it is gone — and collapsing them into "failed" loses exactly
  what tells them whether to retry, refresh, or ask a colleague.
- **Reopening a thread reattaches the cards.** `useOpenConversation` fetches the
  transcript and `GET /copilot/proposals?conversationId=` concurrently and joins
  them on `toolCallId`, which is why the server stores it.
- **`PendingProposals` decides the whole queue in one click**, and it is an
  accelerator rather than a second authority path: it loops over the same
  per-proposal endpoint, so every accept keeps its own capability re-check, its
  own `status = 'pending'` claim and its own audit row. There is deliberately
  **no bulk route** — one would have to reproduce all three and then answer with
  a partial success no card could render. The loop is **sequential** (two
  proposals in one answer routinely touch the same entry) and a failure does not
  stop it: each card records its own error and stays decidable. The queue is
  snapshotted at the click, so a proposal from a still-streaming run is not
  swept into a decision the user never saw.
- **Why it exists at all:** one answer produces a dozen cards — "add alt text to
  every image in this article" is one sentence and twelve proposals. Twelve
  clicks is not review, it is a queue being cleared, and a UI that makes bulk
  work tedious is a UI that gets auto-apply switched on for tools that did not
  warrant it.
- Proposed values render as **text**, never markup — same rule as the tool step's
  payload, and for a stronger reason: this card is where a human approves them.

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

`chatReducer`, the model-choice key helpers and `panelFrame` are unit-tested
(`nx test`) — this is the first admin package with a jest config,
`testEnvironment: 'node'` because the tested code is pure. Anything that has to
be got exactly right about the window's geometry belongs in `panelFrame.ts` for
that reason; `usePanelFrame` should stay thin enough to be obviously correct.
**The panel has no browser-level coverage yet**:
`admin-e2e` mocks `/api` with `page.route` and cannot currently fulfil an
event-stream body. That gap is tracked in `docs/design/copilot.md` §8.

## Commands

- `npx nx typecheck @ortha-cms/copilot-admin`
- `npx nx lint @ortha-cms/copilot-admin`
- `npx nx test @ortha-cms/copilot-admin`
