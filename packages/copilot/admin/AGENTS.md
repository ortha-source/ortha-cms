# @ortha-cms/copilot-admin

The admin-side copilot plugin — **two surfaces onto one chat**.

> **The product is called Ortha AI; this package is called `copilot`.** Every
> `defaultMessage` a user reads says "Ortha AI"; the message **ids**, component
> names, routes and permission keys all keep `copilot`. Deliberate — see the
> naming note at the top of
> [`docs/design/copilot.md`](../../../docs/design/copilot.md). When you add a
> string, follow the same split.

- **The docked panel**, from the shell's `SIDEBAR_FOOTER_SLOT` (or `⌘J`). The
  slot renders **nothing into the sidebar** — it is only what mounts the
  component, which portals the dock and its windows to `<body>`. A chat is a
  window over whatever page you are on, which is the point of it being a
  persistent surface rather than a destination, and there can be **several at
  once**, listed in a bar along the bottom right.
- **The Agents view**, a full page inside the workspace at
  `/workspaces/:id/agents` — history as a column, the transcript with the width
  to render a table or a diff. See [Agents view](#the-agents-view) below.

Both render the _same_ transcript, composer, tool steps, permission prompts and
change cards. Two chat surfaces that diverge is two chat surfaces to keep
correct.

It contributes **no top-level route and no global nav entry**. Runs are
workspace-scoped (`X-Workspace-Id` is required by `WorkspaceGuard`), so
everything here lives strictly inside a workspace: the page and the switcher go
into the workspace shell's own `WORKSPACE_ROUTE_SLOT` / `WORKSPACE_SECTION_SLOT`,
and the launcher renders nothing outside one. There _was_ a top-level route once,
for the workspace's auto-apply policy;
[ADR-0009](../../../docs/adr/0009-copilot-applies-directly.md) deleted the
policy along with the screen, the table, the two routes and `copilot:configure`.
What the copilot may do is what the caller's role may do, so there is nothing
left to configure per workspace.

## Layout

```
domain/
  agentsRoute.ts           # pure: the Agents view's paths + `readAgentThreadId`
  types/chat.ts            # the transcript's view types
application/
  copilotStore.ts          # THE chats — module state, outside React (see below)
  runStream.ts             # the fetch-based SSE transport
  chatReducer.ts           # pure reducer folding run events into a transcript
  useCopilotChat.ts        # a view of one chat in the store; drives its stream
  useComposerAttachments.ts # staged files for the next turn; uploads on add
  tabBadge.ts              # pure: what the tab's (n) counts (tested)
  useTabBadge.ts           # the effect over it: title + favicon dot
  useConversations.ts      # thread list (query)
  useConversation.ts       # one thread: a query (the page) + a mutation (the panel)
  groupConversations.ts    # pure: the rail's date buckets + its filter (tested)
  useAgentThread.ts        # binds the URL to one chat; the page's whole state
  useDecideToolPermission.ts # answer a parked run (mutation)
  useCopilotModels.ts      # the model catalogue + choice-key helpers
  readRouteContext.ts      # pure URL → surface context
  useRouteContext.ts       # the hook over it
  sessions.ts              # pure reducer over the set of open chats (tested)
  useCopilotSessions.ts    # the hook over it: ids + stable callbacks
  panelFrame.ts            # pure move/resize/clamp arithmetic (unit-tested)
  usePanelFrame.ts         # the hook over it: pointer capture + localStorage
presentation/
  copilotPlugin/           # the plugin object: footer slot + route + section
  ViewSwitcher/            # CMS ⇄ Agents, in the workspace sidebar
  AgentsPage/              # the full-page surface
    AgentsTopBar/          #   the one bar: breadcrumb, mobile Chats sheet, model
    AgentsRail/            #   the thread column (md+)
    AgentsRailList/        #   its contents — shared with the mobile sheet
    AgentsThread/          #   the conversation column
    AgentsWelcome/         #   the empty thread: greeting + four openers
  CopilotLauncher/         # ⌘J + the dock, permission-gated
  CopilotDock/             # the bottom bar: one pill per chat, + new chat
  CopilotSession/          # a dock chat's window + its markers
  CopilotPanel/            # the window a visible chat renders in
  PanelResizeHandles/      # the eight grab strips
  MessageList/             # the transcript
  ToolStep/                # one call, as a sentence; `labels.ts` holds both tenses
  Composer/  ModelPicker/  ConversationPicker/
  AttachmentChip/          # one attached file — staged in the composer, sent in the transcript
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
- **The dock is the only entry point to the _panel_.** It replaced the floating
  button, and then the sidebar row went too. A round button could only ever mean
  "the panel", singular; a sidebar row duplicated what the dock already says
  while spending a permanent navigation slot on it. With no chats open the dock
  _is_ a labelled Ortha AI button in the corner — carrying the `⌘J` hint, which
  is where the shortcut is now discoverable — and as soon as there are chats it
  becomes the bar listing them. The Agents view is reached the other way, through
  the sidebar's `ViewSwitcher`, and the dock's button stands down while you are
  on it.
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

## The Agents view

A page at `/workspaces/:id/agents`, contributed to the workspace shell's
`WORKSPACE_ROUTE_SLOT` at `order: 50` — a **high** order on purpose, so the
Content Library (10) stays what `/workspaces/:id` lands on. Three columns: the
app sidebar's workspace nav, the thread rail, the conversation.

**The third column is the point.** Keeping the CMS navigation on screen is what
makes leaving the Agents view one click on something already visible, rather than
a hunt for the way back. The `ViewSwitcher` — a two-segment CMS / Agents control
at the top of the workspace sidebar, `WORKSPACE_SECTION_SLOT` at `order: 5` — is
the two-way control, and going back to the CMS returns you to **the page you
left** (remembered per workspace in `sessionStorage`), not to the workspace's
default section. Someone who breaks off mid-entry to ask a question should not
have to navigate back to it; that round trip is the whole reason both surfaces
exist.

Why a page at all, when the panel exists: the panel is for a question _about the
page you are on_, and it is deliberately small and non-modal. The page is for the
work where the conversation _is_ the task — a long thread, a change to read
carefully, something you asked yesterday. History is a column instead of a
dropdown, and a content-type table or a diff gets the width it needs.

### The URL is the thread

`/…/agents` is an unsaved new chat; `/…/agents/:conversationId` is that thread.
Deep-linkable, reload-safe, and navigable with the browser's own Back button.
Four things about how that is wired are load-bearing:

- **The id is read from the location, not from a nested `<Route>`.** The first
  turn of a new chat mints a thread id and rewrites the URL from the base to the
  thread path — with two route elements React Router would unmount one and mount
  the other **mid-stream**, aborting the very run that produced the id. One
  always-mounted component reading `readAgentThreadId(pathname)` has no such
  seam. Same reason `useCopilotChat` is called once per page and the transcript
  is swapped underneath it, rather than keying a component by thread.
- **Load, clear and adopt are one effect, and the last two are told apart by
  whether the URL just changed.** All three are guarded on `urlId`, and the two
  obvious formulations are both wrong:
    - guarding adoption on "the chat's id differs from the URL's" breaks
      _switching_: clicking another thread while an answer streams makes them
      differ, so the URL gets shoved back to the running chat and the user's own
      navigation is undone. When the URL names a thread, the URL is the
      authority.
    - splitting clear and adopt into two effects breaks _New chat_: both run in
      the same commit, so the adopt effect still reads the **pre-reset**
      conversation id — a state update lands on the next render, not inside the
      effect that asked for it — decides the URL is missing an id, and navigates
      straight back into the thread you just left.

    Hence one effect and a `lastUrlIdRef`: the URL _changed_ to the base means New
    chat (clear); the URL was _already_ the base and an id appeared means the first
    turn started (adopt).

- **Opening a thread is a query here, a mutation in the panel.** A mutation's
  per-call `onSuccess` runs only while the component that called `mutate` is
  still mounted, and this load is kicked off by an effect — React's StrictMode
  remount alone was enough to swallow the callback and strand the page on its
  skeleton for good. The query is disabled the moment the chat is already on the
  thread, which also stops a new chat from fetching back the conversation it is
  streaming into. Read `isFetching`, never `isPending`: a disabled query is
  "pending" forever.
- **Switching threads parks the one you leave; it no longer stops it.** The
  chat goes back to the dock as a live pill (see the store, below). While it
  _did_ stop, it exposed a latent bug in `useCopilotChat` that is still fixed
  and still worth having: `abort()` is not instantaneous, so the run loop checks
  that its own `AbortController` is the current one before dispatching each
  frame, and its `catch`/`finally` are guarded the same way — otherwise a
  cancelled answer appends itself to whichever conversation replaced it.

### The rail

**A row is its name and nothing else.** It carried a timestamp under the title
once; it was true and it was noise, because the group heading above already says
Today / Yesterday / Previous 7 days — the second line spent half the row's height
restating the section it sat in. Dropping it halves the row, which is what makes
twice as many conversations scannable at a glance, and scanning is the only thing
this list is for. Hierarchy carries the selection rather than an accent bar: an
inactive row is muted, the open one is solid on a filled ground, `aria-current`
announces it, and the weight changes too.

The group headings use the full `text-muted-foreground`, **not** an opacity of
it. `/80` at 10px is a serious contrast failure, and the admin-e2e axe scan is
what says so — the token is the one that was verified against AA, so tinting it
further is undoing that check by hand.

`groupConversations` buckets threads by **calendar day**, not by elapsed
milliseconds — a thread from 11pm last night is _yesterday_ at 1am, not "today",
and normalising through a UTC midnight of each local date keeps the DST
transition out of it. Empty buckets are dropped: a "Yesterday" heading with
nothing under it reads as a loading failure. The filter appears only past five
threads (a search box over three rows is furniture that pushes the rows it
searches down the rail), and an **untitled thread matches nothing but the empty
query** — the title is the only text the list route carries.

The rail is a `md:` column; below that it is the same `AgentsRailList` inside a
sheet, opened from the top bar's **Chats** button. Both render it, which is why
that component navigates and holds no chat state: which thread is open is a fact
about the URL.

### Renaming and archiving

Each row carries a `⋯` menu — **Rename…** and **Archive** (or **Unarchive**) —
revealed on hover _or focus_, and positioned over the title rather than in a
column of its own: a permanent second column would truncate every title in an
18rem rail to make room for a control most rows never need.

**There is no Delete, and that is a product decision rather than a gap.** A
thread's proposals are the receipts for changes actually made to your content, so
destroying a conversation destroys the only record the user has of those edits.
Archiving is reversible, keeps the transcript, and is the part people actually
want. See the server package's AGENTS.md for what a hard delete would have to
answer for.

- **The archived list is a mode, not a route.** A footer link switches the rail
  to it, and it appears only once something has been archived — a permanent
  "Archived (0)" is a door to an empty room. It is local state rather than a URL
  param on purpose: Back already moves between threads, and stepping through a
  filter with it would fight that.
- **Archiving the thread you are reading starts a new chat.** Otherwise you are
  left looking at a conversation that is in no visible list.
- **Invalidate `conversationsScopeKey`, never `conversationsKey`.** Every write
  here moves a thread _between_ the two lists, and `conversationsKey(id)`
  defaults `archived` to `false`, so it is the exact key of the active list and
  nothing else — invalidating with it refreshes the list you are looking at and
  leaves the other stale. This was a real bug: archiving worked, and the
  "Archived" link never appeared.
- **Renaming is a dialog, and its focus return is hand-wired.** The dialog is
  opened _from a menu item_, which unmounts with its menu — so Radix has nothing
  to restore focus to and drops it on `<body>`. The row hands up a callback that
  focuses its own menu button, and the dialog calls it from `onCloseAutoFocus`
  with the default prevented. The callback lives in a **ref**, not in state:
  closing clears the dialog's state in the same commit that unmounts it, so a
  callback held in state is already gone when Radix asks for it. Both halves
  were found by driving it, and neither is visible in a screenshot.
- **Save is disabled while saving, never on a validation error.** A greyed-out
  Save refuses without saying why, and on a field the user has not blurred there
  is no message on screen either; submitting an invalid name is what surfaces
  the reason. The field also carries no `maxLength`, so a pasted title too long
  gets an explanation instead of a silent truncation.

### The empty state has a honeycomb behind it

`HoneycombBackdrop` — an SVG lattice of large hexagons in neutral grey
(`text-muted-foreground/30`) at very low alpha, masked by a radial fade centred
on the mark. **Not the brand orange**, which is what it was first: a lattice
covering the whole panel plus an orange mark and an orange card hover is far
more surface than a single accent is meant to carry, and the empty state read as
a different product from the rest of the admin. The mark is `bg-secondary`, the
same light grey tile the app uses elsewhere. A honeycomb because
it is what the surface _is_: a workspace's content is a lattice of small things
that fit together. Three things keep it a backdrop rather than decoration:

- **Big cells.** At half the size it tiled into texture — legible as pattern but
  not as hexagons, which is the difference between a backdrop and a shade of
  grey.
- **The fade ends before the cards do.** It haloes the mark and the greeting and
  has dissolved by the time the suggestions start, so they sit on clean ground.
  Tuned by looking at it; the first pass reached them and the panel read as graph
  paper.
- **`currentColor` off a token class**, so it follows the theme instead of being
  a light-mode flourish that turns into scratches on the dark canvas.

The pattern ids come from `useId()`: two of these can be on screen at once, and
duplicate SVG ids make the second reference the first's pattern. The greeting's
mark is clipped to a hexagon from the same lattice, so it belongs to the pattern
rather than sitting on an unrelated one.

### One bar, not two

`AgentsTopBar` composes the design-system `TopBar` directly, the way
`ContentTopBar` does, instead of a `PageTopBar` plus a header of the thread's
own — that pairing would spend 6rem of a chat surface on chrome. Rendering a real
`TopBar` also matters beyond looks: it is what hosts the sidebar-reveal trigger
when the app sidebar is collapsed, and what makes the shell's floating fallback
toggle stand down. It hoists itself into the inset's fixed strip, so it spans the
rail and the thread both and neither scrolls under it.

### A run keeps going when you leave

Start an answer on the Agents view, navigate to the CMS, and the chat becomes a
**dock pill that is still streaming**. When it lands, the pill says "finished"
and the browser tab shows `(1)`. Come back to that thread from the rail and the
page takes it over again, answer and all.

- **The mechanism is `copilotStore`, not a second copy of anything.** Chats live
  in module state, so no component owns one and unmounting cancels nothing. The
  page _presents_ a chat (`presented: 'page'`); the dock draws neither a window
  nor a pill for it, because it is already on screen and larger than either.
- **`release` decides what survives.** A chat with an answer in flight, or one
  parked on a permission prompt, becomes a pill; **anything else is closed.**
  Keeping every thread you glanced at would fill the dock with conversations you
  merely read — and they are persisted server-side and one click away in the
  rail, so nothing is lost.
- **A chat handed back is a pill, never a window.** A window popping open over
  the page you just navigated to is the surface following you around.
- **The base path still means a new chat.** Going to the Agents view does not
  hoover up whatever is in the dock; opening the _thread_ (from the rail) does,
  and that is the affordance for "put this back on the big screen".
- **The markers were already right.** `unread` is only ever set on a chat that
  is off screen and `awaiting` is live state, so the dock pill and the tab badge
  needed no new rules — just a chat that is still there to report them. Whoever
  is mounted does the reporting: the page while it presents, `CopilotSession`
  once the dock has it back.
- **The ceiling is the tab, and that is not a shortcut.** The server treats a
  client disconnect as an abort (`stopReason: 'aborted'`), so a run cannot
  outlive the page that started it. Surviving a reload or a closed tab needs the
  server to keep the run detached and replay frames on reconnect — plus sticky
  routing, since the permission broker is in-memory. Different, much larger
  feature.

### The tab badge

`(2) Ortha CMS` on the title, and a dot on the favicon, for chats that want you
back — `unread` or `awaiting`, counted **once** per chat. Deliberately no
`Notification.requestPermission()`: it is the only thing that reaches someone who
has switched application, and it costs a prompt you get one chance at, so it is a
product decision rather than a default.

- **The base title is captured once**, at mount. Re-reading `document.title` each
  time stacks `(1) (2) Ortha CMS` — there is a test for it.
- **The favicon is best-effort.** If the icon cannot be drawn (no `<link
rel=icon>`, a format the canvas refuses, a cross-origin taint) the dot is
  skipped and the title still carries the count. Degrading to the title alone is
  fine; blanking someone's favicon is not.

### The dock stands down here — the bar only

On the Agents view the dock's button offers to open the page you are already on,
so it is not rendered. **Only the bar**: every `CopilotSession` stays mounted
regardless, because unmounting one is what cancels its run, and navigating
between two copilot surfaces must never be a disguised Stop. If chats _are_
already open their pills stay, since they are windows that have to remain
reachable.

## Several chats at once

Ask three things, go back to work, come back when the dock says one finished.
That is the feature; everything below is what it costs.

- **Chat state lives in `copilotStore`, outside React.** It used to live in
  `CopilotSession`, one level above the panel, because a hook inside an
  unmounting panel took its `AbortController` cleanup with it — so minimizing
  was a disguised cancel. That fix only ever moved the problem: the Agents page
  hit the same wall one level up, where the unmounting thing was the _route_.
  Now nothing owns a chat. Components are views, and **cancelling is something
  you do — closing a chat — never something that happens to you because a route
  changed.**
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

- **The card lives in the transcript, exactly where the change happened.** A
  turn is an ordered `ChatBlock[]` — prose, tool steps and cards interleaved —
  not three buckets sorted by kind. It _was_ three buckets, and the layout could
  not say when anything occurred: a model that explains, saves, and keeps writing
  produced a card pinned to the bottom while the new text appeared above it, so
  the transcript showed the change happening after the sentences written after
  it. The rule it replaces ("the card renders after the prose") was right about
  the common case and wrong as a layout — chronology gets both.
- **A `text-delta` merges into the newest block only while that block is text.**
  That is the mechanism: a step or a card ends the paragraph, so whatever the
  model writes next starts a new one _below_ it.
- **A reopened thread rebuilds the same order from `content`**, which is the
  model port's block list as the run produced it — so the stored order is the
  order, and each proposal is emitted straight after the `tool_use` that made
  it. Sorting by kind here is what used to strand a card at the bottom of a
  reopened thread too.
- **`ChatBlock` wraps rather than intersects.** `{ kind: 'step' } & ChatToolStep`
  is tidier and silently clobbers `ChatProposal.kind` — the applier that carried
  the change out, `content.entry.update`, which the card renders. The extra
  `.step` / `.proposal` hop is the price of not overwriting a field.
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
- **Stop is the one ending the _client_ has to write for itself.** Every other
  one arrives as a frame; cancelling closes the connection, so the server's
  matching `stopReason: 'aborted'` is recorded on its side and can never reach
  us. And the run loop deliberately bails out of its own `catch` once the
  controller is no longer the chat's current one — which the abort has just made
  true. So `stop()` aborts **and** dispatches `cancelled`; without the second
  half the turn stayed `streaming` forever, `busy` never cleared, and the
  composer's button stayed Stop for the rest of the session. Found by the
  admin-e2e suite, not by reading it.
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

**The choice lives on the session, not in the component that draws the picker.**
Held in `useState` it was lost by collapsing a window _and_ by leaving the Agents
view — the user picked a model, came back, and silently got the default again.
It is still per turn (sent with each message, changeable between them); what was
broken was forgetting it, which nobody chose. A new chat inherits the last model
picked, remembered per tab — so someone who always wants the bigger model does
not re-pick it every time, and it can never become a setting nobody remembers
turning on.

**On the Agents page the picker lives inside the composer, bottom-left** — passed as the
`Composer`'s `controls`, which is the slot for anything that acts on the _next
turn_. Its first home was the page's top bar, and that was the wrong statement:
chrome above the transcript reads as a property of the conversation, and the
model is not one. The panel keeps its picker in its own header row, where it sits
beside the history dropdown; there is no room in a 420px composer for both.

## The composer grows

The field starts at two rows and grows with what you type, capped at `MAX_HEIGHT`
(152px, about six lines) after which it scrolls. Two fixed rows is fine for "how
many authors are there?" and wrong for the paragraph of context that makes a
question answerable — you end up editing through a letterbox. Three details are
load-bearing:

- **`useLayoutEffect`, not `useEffect`.** Measuring after paint shows one frame
  at the old height, which reads as a flicker on every keystroke that wraps.
- **Collapse to `auto` before measuring.** `scrollHeight` never reports less than
  the height already set, so without it the field can grow and never shrink.
- **The border and focus ring are on the wrapper**, not the field — the field is
  stripped of both. The controls row is inside that wrapper, so it reads as one
  box; two nested rings on focus is the giveaway that a composer was assembled
  rather than designed.

## Attaching files

A paperclip in the composer, plus drag-and-drop onto the box and paste from the
clipboard. `useComposerAttachments` stages them; the chips render through the
same `AttachmentChip` the transcript uses, because an attachment does not change
once sent and two components would be two chances for staged and sent to drift.

- **The upload goes through `apiClient`, not the run.** It is an ordinary
  `POST /media/assets` on the user's own session with their own `media:create` —
  the same request the Media Library page makes, from a different button. The
  copilot gains no write path, and a user who cannot upload cannot attach.
- **An attachment is a permanent library asset**, not a blob that dies with the
  conversation: findable later by `media_assets_search`, attachable to a content
  record, subject to the same retention as anything else.
- **Uploading happens on add, not on send**, so the wait is spent while the
  person is still typing and a file that will be rejected is rejected before
  they have written a question about it. Send is blocked while any upload is in
  flight — sending then would drop the file from the turn silently, and once the
  message is gone there is no way to tell "attached" from "still uploading".
- **Removing a chip does not delete the asset.** It means "don't send this with
  my message"; a delete would need `media:delete`, which a contributor who may
  upload does not hold.
- **The run body carries ids only.** The server resolves the name, kind and size
  from the row, because that is the only part it can verify. The optimistic turn
  still renders the full staged refs — the chips were on screen a moment ago,
  and having them vanish until the first frame lands reads as a failed send.
- **`useComposerAttachments` keeps a ref beside its state**, and does its
  arithmetic against the ref. React invokes a `setState` updater twice under
  StrictMode, so counting how many files fit *inside* one would advance the id
  counter twice per file and pair every upload with the wrong chip.
- **The drag highlight counts enter/leave.** Drag events fire per element, so
  entering a child fires `dragleave` on the parent; without the counter the
  overlay flickers across every child the pointer crosses.
- Paste is intercepted **only when the clipboard carries files** — a normal text
  paste has an empty `files` and must not be swallowed.
- The composer renders no attach control at all when the surface passes no
  `attachments` prop, rather than offering a button that fails.

The hint line under the box doubles as the live region for this: the count
refusal and the "waiting for uploads" state are both reasons a send did not
happen, which a screen-reader user otherwise meets as silence.

## Conventions

Follow the `admin-plugin` skill and
[`packages/bootstrap/admin/AGENTS.md`](../../bootstrap/admin/AGENTS.md): the
per-module `<name>/index.tsx` folder layout, the per-hook data layer,
`useHasPermission` gating on `copilot:use` (fail-closed, so a user whose
permissions haven't loaded sees nothing rather than a button that 403s), and
co-located `defineMessages`.

## Testing

`chatReducer`, the model-choice key helpers, `panelFrame`, `sessions`,
`groupConversations` and `agentsRoute` are unit-tested (`nx test`) — this is the
first admin package with a jest config, `testEnvironment: 'node'` because the
tested code is pure. Anything that has to
be got exactly right about the window's geometry belongs in `panelFrame.ts` for
that reason; `usePanelFrame` should stay thin enough to be obviously correct.
The dock and the windows were driven in a real Chromium against a harness of
the actual components — tiling, the cap, titles, the marker's true _and_ false
positives, toggling, closing, drag persistence, Escape, and axe — but **that
harness is not checked in and does not run in CI**.

**The Agents view has `admin-e2e` coverage** — `apps/admin-e2e/src/copilot/`,
seeded by `support/api/copilot.ts`. The claim that it could not, because
`page.route` cannot fulfil an event-stream body, was wrong: it can. The whole
body arrives in one read, so what is lost is only the _progressive_ arrival of
frames — everything about a finished turn, including the **order** of its prose,
steps and change cards, is asserted against the same reducer a live server
drives. Only "watch it type" is out of reach.

The suites are shaped around the bugs this feature actually had, because those
are the ones that come back: New chat not bouncing into the thread you left, the
model choice surviving a trip through the CMS, the transcript's block order both
live and reopened, a run outliving the page as a dock pill and badging the tab,
the archive link appearing at all, the rename dialog's focus return, and an axe
scan of every state.

**The docked panel is covered too** (`dock.spec.ts`), and deliberately does not
re-assert the chat: those components are literally shared with the page. What it
covers is the window — the dock as the only entry point, `⌘J`, three tiled
windows and the cap that minimizes rather than refuses, a pill toggling with
`aria-pressed`, Escape collapsing rather than closing, close handing focus back
to the dock, the `— finished` marker and the tab badge, drag persistence per
**slot**, Expand as the way out of a bad drag, arrow-key moves, and the model
choice surviving a collapse.

**One known gap, and it is a defect rather than missing coverage.** The
"reopening a thread focuses the window already on it" guard lives on the
sessions reducer's `open` action, which is the path the Agents rail takes. The
panel's own **history dropdown** does not go through it — it calls `chat.load()`
and reports the id afterwards as `meta`, which has no such check — so two windows
_can_ end up on one `conversationId`, holding two transcripts that immediately
disagree. Fixing it means routing the picker through a session-level "open this
thread" instead of loading straight into the chat.

## Commands

- `npx nx typecheck @ortha-cms/copilot-admin`
- `npx nx lint @ortha-cms/copilot-admin`
- `npx nx test @ortha-cms/copilot-admin`
