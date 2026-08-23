# @orthacms/copilot-admin — Test Artifact

> **Unit:** `packages/copilot/admin` · **Package:** `@orthacms/copilot-admin` · **Kind:** admin plugin
> **Source of truth:** `packages/copilot/admin/AGENTS.md`
> **Findings verified:** 2026-08-11 — 22 confirmed · 0 deleted · 1 corrected · 0 unverified
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns** the two admin surfaces onto one chat — the **docked window** (⌘J, from
the shell's `SIDEBAR_FOOTER_SLOT`) and the **Agents view**
(`/workspaces/:id/agents`) — plus the module-level chat store both are views of,
the SSE transport, the transcript reducer, and every shared presentation piece:
transcript, composer, tool steps, permission prompts, change cards, skills and
attachment chips, the model picker, the thread rail, and the skills management
page.

**Does NOT own:**

- **Any authority.** `useHasPermission(COPILOT_USE)` hides affordances;
  `WorkspaceGuard` + `PermissionsGuard` on the server are the boundary
  (`CopilotLauncher/index.tsx:47`, `AgentsPage/index.tsx:58` — both fail-closed).
- **The transcript's truth.** Everything rendered comes from
  `POST /api/copilot/runs` frames or `GET /api/copilot/conversations/:id`; see
  `docs/testing/copilot-server.md`.
- **A top-level route or a global nav entry.** Everything is inside a workspace
  (`copilotPlugin/index.tsx`).
- **`apiClient`/axios for the run.** `runStream.ts` uses `fetch` because axios
  cannot stream in the browser.
- **A markdown library.** `Markdown/` is a local renderer; `parseBlocks.ts` is
  unit-tested.
- **Run lifetime beyond the tab.** `copilotStore` is a module singleton
  (`copilotStore.ts:44`); a reload ends every run.

### Entry points

| Kind | What | Where |
| --- | --- | --- |
| Slot | `SIDEBAR_FOOTER_SLOT` → `CopilotLauncher` (mounts the dock + windows, portalled to `<body>`) | `presentation/copilotPlugin/index.tsx` |
| Slot | `WORKSPACE_SECTION_SLOT` `order: 5` → `ViewSwitcher` | same |
| Route | `WORKSPACE_ROUTE_SLOT` `order: 50` → `/workspaces/:id/agents` and `/agents/:conversationId` | `domain/agentsRoute.ts` |
| Route | `/workspaces/:id/agents/skills` → `SkillsPage` (declared **before** the `agents/*` wildcard) | same |
| Shortcut | `⌘J` / `Ctrl+J` | `CopilotLauncher/index.tsx:69-81` |
| Exported | `src/index.ts` — the plugin object and the public component/hook surface | — |

**API the surfaces call** (all through `apiClient` except the run):

`POST /api/copilot/runs` (SSE, via `fetch`) · `POST /api/copilot/runs/:runId/permission`
· `GET /api/copilot/models` · `GET /api/copilot/conversations[?archived=]` ·
`GET /api/copilot/conversations/:id` · `PATCH /api/copilot/conversations/:id` ·
`GET /api/copilot/proposals?conversationId=` · `GET /api/copilot/skills` ·
`GET|POST|PATCH|DELETE /api/copilot/skills[/manage|/:id]` ·
`POST /api/media/assets` (attachment upload, on the user's own `media:create`).

### Runtime prerequisites

- The whole stack: `docker compose up -d`, `.env`, `COPILOT_ENABLED=true`,
  `npx nx run server:db:migrate`, `npm run dev`.
- A signed-in user holding **`copilot:use`**, inside a workspace. Outside a
  workspace the launcher renders **nothing** (`CopilotLauncher/index.tsx:50,94`).
- `copilot:skills:manage` (admin) for the skills page and the rail's link to it.
- A model backend. `COPILOT_PROVIDER` defaults to `fake`, whose canned dev reply
  is deterministic — good for driving the UI, useless for judging streaming.
- `media:create` to exercise attachments.
- At least one workspace skill (and ideally one `mode: 'always'`) to exercise the
  skills chips.

### How to exercise it manually

```bash
docker compose up -d && COPILOT_ENABLED=true npm run dev
# admin at http://localhost:4200
```

- **Docked window:** open any workspace page → the dock sits bottom-right → press
  **⌘J** (or click the **Ortha AI** button).
- **Agents view:** in the workspace sidebar, the **CMS / Agents** segmented
  control → **Agents**; or go straight to
  `http://localhost:4200/workspaces/<id>/agents`.
- **Skills page:** `…/agents/skills`, admin only.
- **A permission prompt:** ask for a write ("add a summary to the Designing for
  editors article") as a contributor or admin in a thread that has not already
  allowed that tool.

Automated:

```bash
npx nx test @orthacms/copilot-admin     # 🧪 chatReducer, sessions, panelFrame,
                                         #    groupConversations, agentsRoute,
                                         #    tabBadge, parseBlocks, labels,
                                         #    routeContext, useCopilotModels
npx nx e2e admin-e2e -- --project=chromium src/copilot/
npx nx typecheck @orthacms/copilot-admin
```

### Dependencies that must be healthy

- `@orthacms/identity-admin` — `useHasPermission` (fail-closed).
- `@orthacms/workspaces-admin` — `useCurrentWorkspace` (usable **only** inside
  the workspace shell's inset; the launcher must not call it — it *throws*
  outside the provider, taking the whole admin down, which is why
  `useRouteContext` reads the URL instead).
- `@orthacms/design-system` — `Button`, `Textarea`, `Alert`, `Collapsible`,
  `Dialog`, `Sheet`, `DropdownMenu`, `SegmentedControl`, `TopBar`, `Spinner`,
  `Toaster`, `Kbd`, `Skeleton`.
- `@orthacms/copilot-domain` — `CopilotRunEvent`, `ToolPermissionDecision`.
- `react-intl` (host `IntlProvider`), TanStack Query, React Router.
- The **shell** must render the sidebar footer slot and the workspace route/section
  slots, or nothing here mounts at all.

---

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | Plugin contributes footer slot + workspace route + workspace section, and **no** top-level route | `presentation/copilotPlugin/index.tsx` | ⚠️ PARTIAL — the surfaces are driven, the contribution shape is not asserted |
| F2 | Launcher renders nothing without `copilot:use` or outside a workspace | `CopilotLauncher/index.tsx:50,94` | ✅ E2E `apps/admin-e2e/src/copilot/dock.spec.ts:58`, `agents-view.spec.ts:206` |
| F3 | `⌘J` / `Ctrl+J` starts a chat, only while the launcher is available | `CopilotLauncher/index.tsx:69-81` | ✅ E2E `dock.spec.ts:47` |
| F4 | The dock is the only entry point; with nothing open it is a labelled **Ortha AI** button carrying the `⌘J` hint | `CopilotDock/index.tsx:169-193` | ✅ E2E `dock.spec.ts:31` |
| F5 | A pill toggles its window; `aria-pressed` says which state | `CopilotDock/index.tsx:110-113` | ✅ E2E `dock.spec.ts:92` |
| F6 | The marker (`unread` / `awaiting`) is in the pill's **accessible name**, not only the dot; `awaiting` outranks `unread` | `CopilotDock/index.tsx:117-127` | ⚠️ PARTIAL — `dock.spec.ts:160` covers `— finished`; **nothing covers `— waiting for you`** |
| F7 | Closing a pill discards the chat, cancels its run, and hands focus to the dock | `CopilotLauncher/index.tsx:128-131`, `copilotStore.ts:160-167` | ✅ E2E `dock.spec.ts:122` |
| F8 | Tab badge: `(n)` on the title, dot on the favicon, base title captured once | `useTabBadge.ts:26-70`, `tabBadge.ts` | 🧪 UNIT `tabBadge.spec.ts` · ✅ E2E `dock.spec.ts:160` |
| F9 | Window cap of 3 — a fourth **minimizes the oldest** rather than refusing | `sessions.ts:297-314` | 🧪 UNIT `sessions.spec.ts` · ✅ E2E `dock.spec.ts:69` |
| F10 | Move: drag the header, or arrow keys on the grip (`Shift` for bigger steps) | `CopilotPanel/index.tsx:347-357,422-445` | ✅ E2E `dock.spec.ts:222,262` |
| F11 | Resize: eight strips, seven `aria-hidden` and pointer-only, the NW corner keyboard-operable | `PanelResizeHandles/index.tsx:78-110` | ❌ NONE — no spec resizes, by pointer or by keyboard |
| F12 | Expand / Shrink are one control, relabelled off the **preset**, and clear a drag | `CopilotPanel/index.tsx:262,374-386` | ✅ E2E `dock.spec.ts:200,248` |
| F13 | Geometry persists per **slot** (not per chat) in `localStorage` | `usePanelFrame.ts`, `panelFrame.ts` | 🧪 UNIT `panelFrame.spec.ts` · ✅ E2E `dock.spec.ts:222` |
| F14 | Escape **collapses** to the dock; it does not close or cancel | `CopilotPanel/index.tsx:224-229` | ✅ E2E `dock.spec.ts:109` |
| F15 | The window is `role="dialog"` and deliberately **non-modal** (no `aria-modal`, no trap, no overlay) | `CopilotPanel/index.tsx:279-284` | ⚠️ PARTIAL — axe scans it (`dock.spec.ts:316`); nothing asserts Tab leaves the panel |
| F16 | The composer takes focus when a window opens | `CopilotPanel/index.tsx:501-503` | ✅ E2E `dock.spec.ts:31` |
| F17 | Focus is returned to the trigger when a window **closes** | `CopilotLauncher/index.tsx:130` | ✅ E2E `dock.spec.ts:122` |
| F18 | Focus is returned when a window is **minimized** | `CopilotPanel/index.tsx:250` + `CopilotSession/index.tsx:102` | ❌ NONE → 🐞 BUG-copilot-admin-02 |
| F19 | The panel's history dropdown opens a saved thread | `ConversationPicker/index.tsx`, `CopilotPanel/index.tsx:509-514` | ⚠️ PARTIAL — `dock.spec.ts:185` opens one; nothing asserts it does not duplicate a window → 🐞 BUG-copilot-admin-01 |
| F20 | Model picker: per **turn**, held on the session, seeded into the next chat, hidden when one backend | `ModelPicker/index.tsx`, `sessions.ts:57`, `copilotStore.ts:190-198` | 🧪 UNIT `useCopilotModels.spec.ts` · ✅ E2E `dock.spec.ts:278`, `agents-chat.spec.ts:87` |
| F21 | Agents route: `/agents` is a new chat, `/agents/:id` is that thread; deep-linkable and Back-navigable | `domain/agentsRoute.ts`, `useAgentThread.ts` | 🧪 UNIT `agentsRoute.spec.ts` · ✅ E2E `agents-chat.spec.ts:27,63` |
| F22 | The first turn promotes the URL from the base to the thread path **without unmounting** | `useAgentThread.ts` | ✅ E2E `agents-chat.spec.ts:27` |
| F23 | **New chat** clears rather than bouncing back into the thread just left | `useAgentThread.ts` (`lastUrlIdRef`) | ✅ E2E `agents-view.spec.ts:145` |
| F24 | Rail: threads grouped by **calendar day**, empty buckets dropped | `groupConversations.ts` | 🧪 UNIT `groupConversations.spec.ts` · ✅ E2E `agents-view.spec.ts:29` |
| F25 | Rail filter appears only past five threads; an untitled thread matches nothing but the empty query | `groupConversations.ts`, `AgentsRailList/index.tsx:266` | 🧪 UNIT `groupConversations.spec.ts` · ✅ E2E `agents-view.spec.ts:55` |
| F26 | Rail row marks the open thread with `aria-current="page"` | `AgentsRailRow/index.tsx:103` | ✅ E2E `agents-view.spec.ts:99` |
| F27 | Row menu: Rename… / Archive / Unarchive, revealed on hover **or focus**; `modal={false}` | `AgentsRailRow/index.tsx:114-130` | ✅ E2E `agents-manage.spec.ts:26,99,123` · axe `a11y.spec.ts:71` |
| F28 | **No Delete** anywhere | absent by design | ✅ E2E `agents-manage.spec.ts:160` |
| F29 | Rename dialog: Save never disabled on invalid, no `maxLength`, focus returned to the row's menu button | `RenameChatDialog/index.tsx` | ✅ E2E `agents-manage.spec.ts:45,82` · axe `a11y.spec.ts:63` |
| F30 | Archived list is a mode; the link appears only once something is archived; `conversationsScopeKey` invalidation | `AgentsRailList/index.tsx`, `useUpdateConversation.ts` | ✅ E2E `agents-manage.spec.ts:99,123` · axe `a11y.spec.ts:54` |
| F31 | Archiving the thread you are reading starts a new chat | `AgentsRailList/index.tsx` | ✅ E2E `agents-manage.spec.ts:143` |
| F32 | Below `md` the rail lives in a **Sheet** behind the top bar's **Chats** button | `AgentsTopBar/index.tsx:120-149` | ❌ NONE — no viewport under `md` is ever driven |
| F33 | `ViewSwitcher` says which mode you are in, in both; returns to the CMS page you left | `ViewSwitcher/index.tsx:99-121` | ✅ E2E `view-switcher.spec.ts:26,48,65` |
| F34 | The dock stands down on the Agents view **only while it owns nothing** | `CopilotLauncher/index.tsx:56` | ✅ E2E `view-switcher.spec.ts:85` |
| F35 | Empty thread: greeting, four openers, honeycomb backdrop with `useId()` pattern ids | `AgentsWelcome/index.tsx`, `HoneycombBackdrop/index.tsx` | ✅ E2E `agents-view.spec.ts:165` · axe `a11y.spec.ts:29` |
| F36 | A run outlives the page: leaving the Agents view mid-answer makes it a streaming dock pill; returning takes it back | `useCopilotSessions.ts` (`release`), `sessions.ts:235-260` | ✅ E2E `agents-chat.spec.ts:140` |
| F37 | `release` keeps a chat that is busy or `awaiting`; closes anything else | `useCopilotSessions.ts` | ⚠️ PARTIAL — the busy branch is covered; the `awaiting` branch is not |
| F38 | Transcript blocks render **in the order the run produced them**, live and reopened | `chatReducer.ts`, `MessageList/index.tsx:210-224` | 🧪 UNIT `chatReducer.spec.ts:104-175` · ✅ E2E `agents-chat.spec.ts:27`, `agents-view.spec.ts:119` |
| F39 | A `text-delta` merges into the newest block only while that block is text | `chatReducer.ts` | 🧪 UNIT `chatReducer.spec.ts:121,196` |
| F40 | `ToolStep` reads as a sentence in two tenses; an unknown tool degrades via `humanizeToolName` | `ToolStep/index.tsx:63-100`, `labels.ts` | 🧪 UNIT `labels.spec.ts` · ✅ E2E `a11y.spec.ts:50` (expanded) |
| F41 | "Thinking…" also shows **between** steps, and stands down while a step runs | `MessageList/index.tsx:248-259` | ❌ NONE |
| F42 | A failed apply draws as a **failed** step | `chatReducer.ts`, `ToolStep/index.tsx:85-92` | ⚠️ PARTIAL — the reducer's `ok:false` path is unit-tested; nothing renders a failed step in a browser |
| F43 | `ProposalCard` is a past-tense receipt with no buttons; named by its own summary | `ProposalCard/index.tsx:72-95` | ✅ E2E `a11y.spec.ts:39`, `dock.spec.ts:333` |
| F44 | `pending` renders as **Not saved** with the server's reason, keyed off status not `error` | `ProposalCard/index.tsx:76,128-140` | 🧪 UNIT `chatReducer.spec.ts:524,537` — never rendered in a browser |
| F45 | A reopened thread reattaches cards by joining `GET /proposals?conversationId=` on `toolCallId` | `useConversation.ts` | ✅ E2E `agents-view.spec.ts:119` |
| F46 | `PermissionPrompt` — three buttons, in the transcript, never a modal | `PermissionPrompt/index.tsx:72-141` | 🧪 UNIT (reducer only) `chatReducer.spec.ts:393-462` · ❌ NONE in a browser → see §5 |
| F47 | A 404 from the answer keeps the buttons and says the answer did not land | `useCopilotChat.ts:315-321`, `PermissionPrompt/index.tsx:97-105` | 🧪 UNIT `chatReducer.spec.ts:432` · ❌ NONE rendered |
| F48 | A `tool-result` for a parked call retires its prompt | `chatReducer.ts:351-357` | 🧪 UNIT `chatReducer.spec.ts:448,456` |
| F49 | `awaiting` is live state (not an edge), and the `awaiting` action returns the same array when unchanged | `sessions.ts:262-275`, `CopilotSession/index.tsx:98-100` | 🧪 UNIT `sessions.spec.ts` · ❌ NONE end-to-end |
| F50 | Composer grows to `MAX_HEIGHT` then scrolls; measured with `useLayoutEffect`, collapsed to `auto` first | `Composer/index.tsx:73,174-181` | ✅ E2E `agents-chat.spec.ts:114` |
| F51 | Enter sends, Shift+Enter newlines, IME composition is not a send | `Composer/index.tsx:216-225` | ⚠️ PARTIAL — Enter is used throughout; **no IME case** |
| F52 | Send becomes **Stop** while busy; `stop()` aborts *and* writes `cancelled` into the transcript | `Composer/index.tsx:369-388`, `useCopilotChat.ts:297-303` | ✅ E2E `agents-chat.spec.ts:162` |
| F53 | Attachments: paperclip, drag-and-drop (enter/leave counted), paste (files only) | `Composer/index.tsx:197-253,328-357` | ✅ E2E `agents-attachments.spec.ts:41,226,245,262,277` |
| F54 | Upload happens on **add**; send is blocked mid-upload; the hint line says why | `useComposerAttachments.ts`, `Composer/index.tsx:186,391-408` | ✅ E2E `agents-attachments.spec.ts:149,179` |
| F55 | Removing a chip drops it from the turn and does **not** delete the asset | `Composer/index.tsx:306` | ✅ E2E `agents-attachments.spec.ts:128` |
| F56 | Attachment cap refusal is announced through the hint's live region | `Composer/index.tsx:391-408` | ✅ E2E `agents-attachments.spec.ts:200` |
| F57 | Two distinct list names — "Files to send" vs "Attached files" | `Composer/index.tsx:49-52`, `MessageList/index.tsx:15-18` | ✅ E2E `agents-attachments.spec.ts:299` |
| F58 | Skills: picker beside the paperclip, chips above the field, count in the button's accessible name and **no** `aria-label` | `SkillPicker/index.tsx:155-171` | ✅ E2E `agents-skills.spec.ts:74` |
| F59 | An always-on chip carries a lock, not an `×`, and its name is **not** sent | `SkillChip/index.tsx:59`, `useCopilotChat.ts:220-226` | ✅ E2E `agents-skills.spec.ts:59` |
| F60 | Skills are sticky across turns and seeded into the next chat | `AgentsThread/index.tsx:112-116`, `copilotStore.ts:200-208` | ✅ E2E `agents-skills.spec.ts:112,138` |
| F61 | A staged name missing from the catalogue is dropped, not sent | `useComposerSkills.ts` | ❌ NONE |
| F62 | The picker renders nothing when the workspace has no skills | `Composer/index.tsx:358` | ✅ E2E `agents-skills.spec.ts:173` |
| F63 | Skills management page: list, create, edit, delete, identifier not rewritten under a title edit | `SkillsPage/**` | ✅ E2E `skills-manage.spec.ts:25,44,72,93,109` |
| F64 | The rail's skills link is permission-gated and fail-closed | `AgentsRailList/index.tsx` | ✅ E2E `skills-manage.spec.ts:176,194` |
| F65 | `ContextChip` — context is **opt-in**, shown, and a snapshot | `ContextChip/index.tsx`, `readRouteContext.ts` | 🧪 UNIT `routeContext.spec.ts` · ❌ NONE rendered |
| F66 | `new` / `trash` are excluded from `entryId` | `readRouteContext.ts` | 🧪 UNIT `routeContext.spec.ts` |
| F67 | Markdown: paragraphs, headings, code, **pipe tables**, lists, inline; React elements only, never `dangerouslySetInnerHTML`; link hrefs scheme-allow-listed | `Markdown/index.tsx`, `parseBlocks.ts` | 🧪 UNIT `parseBlocks.spec.ts` — the **renderer** (table markup, link filtering) is untested |
| F68 | Errors: destructive `Alert` for a failed turn, warning `Alert` for a truncated one, a quiet line for a cancel | `MessageList/index.tsx:261-294` | ⚠️ PARTIAL — `agents-chat.spec.ts:162` covers the cancel line only |
| F69 | `toast.error` **only while minimized**, and only for systemic failures | `useCopilotChat.ts:261-268` | ❌ NONE |
| F70 | `describe()` classifies abort / `CopilotRunError` / 401 / `TypeError` | `useCopilotChat.ts:388-412` | ❌ NONE → 🐞 BUG-copilot-admin-05 (a hardcoded string in it) |
| F71 | A run loop bails once its controller is no longer the chat's current one | `useCopilotChat.ts:237-248` | ❌ NONE |
| F72 | The store is outside React, so no unmount cancels a run | `copilotStore.ts:44-55` | 🧪 UNIT (reducers) · ✅ E2E indirectly `agents-chat.spec.ts:140` |
| F73 | Sending is refused silently while a run is in flight | `useCopilotChat.ts:168-170` | ❌ NONE → 🐞 BUG-copilot-admin-06 |
| F74 | The panel is portalled to `<body>` and states `text-foreground` on its root | `CopilotLauncher/index.tsx:115`, `CopilotPanel/index.tsx:310` | ⚠️ PARTIAL — axe's `color-contrast` would catch a regression on a scanned state |
| F75 | Every string goes through co-located `defineMessages` | throughout | ⚠️ PARTIAL — three leaks; see 🐞 BUG-copilot-admin-04 / -05 |

---

## 3. Manual Test Plan

**Global preconditions.** `COPILOT_ENABLED=true npm run dev`; signed in as an
**admin** in workspace **A** which is granted `article` and holds several
entries; at least six copilot conversations exist, spread over today, yesterday
and last week, one of them untitled; one workspace skill `house-style`
(`manual`) and one `tone` (`always`); at least one media asset. A second browser
profile signed in as a **viewer** for the permission cases. `$WS` = workspace
A's id.

Every block carries a **keyboard-only path** and a **screen-reader expectation**,
per §4A.

---

### F2 — the launcher is gated

**Preconditions:** admin, and a role with every permission except `copilot:use`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | As admin, open `/workspaces/$WS` | The dock renders bottom-right: a pill-shaped button reading **Ortha AI** with a `⌘J` chip |
| 2 | Navigate to `/workspaces` (the list, outside a workspace) | The dock is **gone** — no button, no bar |
| 3 | Sign in as the role without `copilot:use`, open `/workspaces/$WS` | No dock, no **CMS / Agents** switcher in the sidebar |
| 4 | Same role, type `/workspaces/$WS/agents` into the address bar | The page renders an `Empty` with `role="alert"`, title **No access**, body "You don't have permission to use Ortha AI here." |
| 5 | Reload with the network throttled so `/auth/me` is slow | Nothing copilot-related flashes before permissions resolve — fail-closed |

**Keyboard-only:** Tab from the page top; the dock button is the **last** stop
before the browser chrome (it is portalled to the end of `<body>`).
**Screen reader:** the button announces as "Ortha AI, button".

### F3 — `⌘J`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | On `/workspaces/$WS`, press **⌘J** (macOS) or **Ctrl+J** (Windows/Linux) | A window opens bottom-right with focus in the message box |
| 2 | Press **⌘J** again | A **second** window opens beside the first, not a toggle |
| 3 | Focus the browser address bar and press ⌘J | The handler is on `window`, so the chat still opens — confirm it does not also open the browser's Downloads |
| 4 | On `/workspaces` (no workspace), press ⌘J | Nothing happens; the browser's own ⌘J is not suppressed either |
| 5 | On Windows, read the dock's hint chip | It says `⌘J` — see 🐞 BUG-copilot-admin-08 |

### F4 / F5 / F6 / F7 — the dock

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | With nothing open, inspect the dock | One button: **Ortha AI** + `⌘J` chip. Below the `sm` breakpoint the chip is hidden |
| 2 | Open two chats | The dock is now a bar of two pills plus a `+` button; each pill shows a sparkle, a name and an `×` |
| 3 | Ask something in chat 1, then click its pill | The window collapses; the pill's `aria-pressed` flips to `false` |
| 4 | Click it again | The window reopens, `aria-pressed="true"` |
| 5 | Ask a question in the collapsed chat and wait for it to finish | The pill's accessible name becomes "*{title}* — finished" and a dot appears; the browser tab title becomes `(1) Ortha CMS` and the favicon gains a dot |
| 6 | Open that chat | The marker clears and the tab title returns |
| 7 | Ask for a **write** in a collapsed chat so it parks | The pill's accessible name becomes "*{title}* — waiting for you" and the dot is amber |
| 8 | With both a finished and a parked chat collapsed | Each pill carries its own marker; a chat that is both reads "waiting for you", not "finished" |
| 9 | Click a pill's `×` while its run streams | The chat disappears, the run is aborted, and focus lands on the dock's **New chat** button |
| 10 | Before any turn, read the untitled pill's name | **Untitled chat**, never "New chat" |

**Keyboard-only:** Tab reaches every pill and every `×` in DOM order —
`2N + 1` stops for N chats. **Arrow keys do nothing**, despite
`role="toolbar"`. See ♿ A11Y-copilot-admin-06.
**Screen reader:** the container announces "Ortha AI chats, toolbar".

### F8 — the tab badge

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Note the tab title, e.g. `Ortha CMS` | — |
| 2 | Let two collapsed chats finish | Title reads `(2) Ortha CMS`, favicon carries a dot |
| 3 | Open one | `(1) Ortha CMS` |
| 4 | Open the other | `Ortha CMS` — never `(1) (2) Ortha CMS` (the base title is captured once) |
| 5 | Serve the admin with the `<link rel=icon>` removed | The dot is skipped; the count still shows; nothing throws |
| 6 | Navigate between routes with a badge showing | The route never appears in the title — see ♿ A11Y-copilot-admin-13 |

### F9 — the window cap

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open three chats | Three windows tile right-to-left, `27.5rem` apart |
| 2 | Open a fourth | Four pills; the **oldest** window collapses to a pill and the new one is visible. Nothing is refused |
| 3 | Ask something in the collapsed one first | It keeps streaming while collapsed and marks its pill when it lands |
| 4 | Repeat on a 1280px window | Still three; the leftmost may run off the left edge — confirm `max-w-[calc(100vw-2rem)]` keeps it on screen |

### F10 / F11 / F12 / F13 — moving and resizing

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Drag the window header to the top-left | It follows the pointer; the whole window stays on screen even if you drag past the edge |
| 2 | Release, reload the page, open a chat | The window is back where you put it — geometry is per **slot** in `localStorage` |
| 3 | Open a second chat and drag it elsewhere; close the first | The remaining window keeps its own geometry; the two do not swap positions |
| 4 | Drag the **west** edge past the minimum width | That edge stops; the window does **not** tow across the screen |
| 5 | Drag the north edge past the minimum height | Same |
| 6 | Resize to 400px wide, then read the size button | It says **Expand**, not "Shrink" |
| 7 | Click **Expand** | The window jumps to the expanded preset in the corner — the placement is cleared |
| 8 | Drag the window mostly off the bottom, then click **Expand** | It is recoverable; this is the documented escape |
| 9 | Focus the grip (leftmost header control) and press **→** ten times | The window moves right in small steps |
| 10 | Hold **Shift** and press **→** | Larger steps |
| 11 | While the grip is focused and you press an arrow | The page behind does **not** scroll |
| 12 | Tab through the window | Exactly **one** resize affordance is focusable (the NW corner) plus the grip — not eight |
| 13 | With the NW corner focused, press arrow keys | The window resizes |
| 14 | Shrink the viewport to 800×600 with a saved 1200px-wide frame | The window slides in and is clamped to the viewport; no horizontal page scroll |

### F14 / F15 / F16 / F17 / F18 — focus and Escape

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Press ⌘J | The window opens and the caret is in the message box |
| 2 | Tab forward repeatedly from the composer | Focus **leaves** the window and enters the page behind — no trap (deliberate) |
| 3 | Click a control on the page behind the window | It works; nothing is dimmed or blocked |
| 4 | With focus inside the window, press **Escape** | The window collapses to a pill; the run (if any) keeps going |
| 5 | Immediately press **Tab** | Expected: focus is on the dock's New chat button. **Observed:** focus is on `<body>`, so Tab starts from the top of the document → 🐞 BUG-copilot-admin-02 |
| 6 | Open a window, click **×** | Focus lands on the dock's New chat button (this path *is* wired) |
| 7 | Open a page dialog (e.g. the rename dialog) behind the window and press Escape inside the panel | Only the panel collapses; the dialog is untouched |
| 8 | Open three windows and inspect their accessible names | All three announce as "Ortha AI, dialog" — indistinguishable → ♿ A11Y-copilot-admin-05 |

### F19 — the history dropdown (and the duplicate-window defect)

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open a window, click the history icon in its header | A menu of the workspace's threads |
| 2 | Pick one | The window loads that transcript |
| 3 | Open a **second** window and pick the **same** thread from its history | Expected: the first window is focused and no second copy appears. **Observed:** two windows now show one `conversationId` → 🐞 BUG-copilot-admin-01 |
| 4 | Send a turn in one of them | Only that window's transcript grows; the other is now stale and wrong |
| 5 | Compare with the Agents rail: open a thread there while it is already a dock window | The existing window is focused instead (the `open` action's guard) |

### F20 — the model picker

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open the picker | "Default" plus one entry per provider × model from `GET /api/copilot/models` |
| 2 | Pick a non-default and send | The request body carries `provider` and `model` |
| 3 | Collapse the window and reopen it | The pick is still shown |
| 4 | On the Agents view, pick a model, go to the CMS, come back | Still picked |
| 5 | Start a brand-new chat | It inherits the last pick (per tab) |
| 6 | Reload the tab | Back to Default |
| 7 | Configure the host with a single provider offering a single model | The picker is not rendered at all |

### F21 / F22 / F23 — the URL is the thread

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Go to `/workspaces/$WS/agents` | The welcome state: greeting + four openers, honeycomb behind |
| 2 | Ask something | The URL becomes `/workspaces/$WS/agents/<id>` **without** the answer being interrupted — the stream continues to completion |
| 3 | Press the browser **Back** button | Back on the base path, a new empty chat |
| 4 | **Forward** | Back in the thread, transcript intact |
| 5 | Open a thread from the rail, then click **New chat** | The base path, an empty chat — it does **not** bounce back into the thread you left |
| 6 | Start an answer, then click another thread in the rail mid-stream | The URL and the transcript follow **your** click; the running chat is parked to the dock as a live pill |
| 7 | Paste `/workspaces/$WS/agents/<id>` into a new tab | The thread loads from the server |
| 8 | Paste a `<id>` from another workspace | The thread fails to open and offers **Try again** (not a blank page) |

### F24 / F25 / F26 — the rail

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open the Agents view | Headings **Today**, **Yesterday**, **Previous 7 days** with rows under each; no empty heading |
| 2 | A thread from 23:30 last night, viewed at 01:00 | Under **Yesterday**, not Today |
| 3 | With three threads | No filter box |
| 4 | With six | A filter box appears |
| 5 | Type a title fragment | Only matching rows |
| 6 | Type anything with an untitled thread present | The untitled thread never matches |
| 7 | Clear the filter | The untitled thread reappears |
| 8 | Open a thread | Its row is solid on a filled ground, weight changes, and carries `aria-current="page"` |
| 9 | Inspect the group headings' colour | Full `text-muted-foreground`, **not** an opacity of it |

### F27 / F28 / F29 — row menu, rename, no delete

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Hover a row | A `⋯` button appears over the title |
| 2 | Tab to the row and Tab again | The `⋯` becomes visible on **focus**, not only on hover |
| 3 | Open the menu | **Rename…**, **Archive**. No Delete, no Duplicate |
| 4 | Choose **Rename…** | A dialog with the current title selected |
| 5 | Clear the field and press **Save** | Save is **not** disabled; pressing it shows the reason under the field |
| 6 | Paste a 300-character title and Save | An explanation, not a silent truncation (no `maxLength` on the field) |
| 7 | Type a valid title and Save | The rail row and the top bar's breadcrumb both update |
| 8 | Close the dialog with **Escape** | Focus returns to the `⋯` button of the row it was opened from — **not** `<body>` |
| 9 | Close with the **×** | Same |
| 10 | Make the PATCH fail (offline) | The dialog says the server refused; the row is unchanged |

### F30 / F31 — archiving

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | With nothing archived, look at the rail footer | There is **no** "Archived" link |
| 2 | Archive a thread | The row leaves the list and an **Archived** link appears |
| 3 | Click it | The rail switches to the archived list, showing that thread |
| 4 | **Unarchive** it | It leaves the archived list; the active list has it back — both lists refetched |
| 5 | Archive the thread you are currently reading | The view moves to a new empty chat, not to a thread in no list |
| 6 | Press Back after archiving | The URL history still works; the archived thread's own URL still loads it |

### F32 — the mobile rail

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Resize to 375 × 812 | The rail column is gone; a **Chats** button appears in the top bar |
| 2 | Click it | A left Sheet with the same list, its own filter and New chat |
| 3 | Pick a thread | The sheet closes and the thread opens |
| 4 | Press **Escape** in the sheet | It closes and focus returns to the **Chats** button |
| 5 | Tab while the sheet is open | Focus is trapped inside it (it is a real modal `Sheet`) |

### F33 / F34 — the CMS ⇄ Agents switch

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | On `/workspaces/$WS/content/article?page=2`, click **Agents** | The Agents view opens |
| 2 | Click **CMS** | Back on `/workspaces/$WS/content/article?page=2` — the **query string** too |
| 3 | Click **CMS** again while already on the CMS | Nothing happens; no navigation, no third state |
| 4 | Open a workspace fresh and click **CMS** with no memory | The workspace base, `/workspaces/$WS` |
| 5 | Disable site data (blocking `sessionStorage`) and repeat | The switcher still works; it lands on the workspace base |
| 6 | Switch to a **different** workspace, then back | Each workspace remembers its own return path |
| 7 | On the Agents view with nothing in the dock | The dock is not rendered |
| 8 | Start an answer, navigate to the CMS, come back to Agents | The pill is still there — the dock does **not** stand down while it owns a chat |

### F36 / F37 — a run outliving the page

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Ask a long question on the Agents view; while it streams, click **CMS** | The chat becomes a dock pill that is **still streaming** |
| 2 | Wait for it | The pill says "— finished" and the tab shows `(1)` |
| 3 | Go back to Agents and open that thread from the rail | The page takes it back, full answer included, and the pill disappears |
| 4 | Ask something, let it **finish**, then navigate away | The chat is **closed** (not kept) — nothing new in the dock |
| 5 | Park a chat on a permission prompt, then navigate away | It **is** kept, as a pill reading "— waiting for you" |
| 6 | Reload the browser tab mid-answer | The run is gone — the store's lifetime is the tab, and the server records `aborted` |

### F38 / F39 / F40 / F41 / F42 — the transcript

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Ask something that makes the model explain, search, save, then keep writing | The blocks render **in that order**: prose, step, card, prose — the card is not pinned to the bottom |
| 2 | Reload and reopen the thread | The same order, rebuilt from `content` |
| 3 | Watch a tool step while it runs | "Searching content…" with a spinner |
| 4 | After it lands | "Searched content · 12 results · 41ms" with a green tick |
| 5 | Click the step | It expands to Tool / Input / Output payloads, rendered as text in `<pre>` |
| 6 | Make a tool fail | A red icon and the word **Failed** with the reason in the expanded panel |
| 7 | Ask something where the model thinks between two tool calls | "Thinking…" appears **between** them, and stands down while a step is running |
| 8 | Ask about an unknown/connector tool | The step reads a humanized name ("Fetch orders"), not `mcp.acme.fetch_orders` |

### F43 / F44 / F45 — change cards

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Allow a write and let it apply | A card with the summary as its title, the applier kind in mono, a **Saved** badge, and a before/after `<dl>` per field |
| 2 | Confirm it has **no buttons** | Nothing to accept or reject |
| 3 | Make the apply fail (delete the target entry first) | The card shows a destructive **Not saved** badge and the server's own reason |
| 4 | Reload and reopen the thread | The card is back, attached to the same step, with the failure reason |
| 5 | With three cards in one thread | Each announces by its own summary, never "Change" three times |
| 6 | A `create` proposal (no `before`) | The diff shows only **After** — no fabricated "—" |

### F46 / F47 / F48 / F49 — the permission prompt

**Preconditions:** a thread that has **not** already allowed the tool.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Ask "add a summary to the Designing for editors article" | Streaming pauses. A bordered card appears in the transcript: **Ortha AI wants to change your content**, the tool name in mono, the **exact arguments** as pretty JSON, "Nothing has happened yet — it is waiting for you.", and three buttons |
| 2 | Confirm nothing has happened | `select * from copilot_proposals` — no row; the entry is unchanged |
| 3 | Confirm it is **not** a modal | The page behind is fully clickable; nothing is dimmed |
| 4 | Click **Allow once** | The buttons disable, the primary shows a spinner, then the prompt disappears and the run resumes |
| 5 | Ask for a second write in the same thread | It asks again |
| 6 | Answer **Allow for this chat** | It runs, and a third write in the same thread does **not** ask |
| 7 | Start a new thread and ask for a write | It asks again — the memory dies with the thread |
| 8 | Click **Don't allow** | The prompt goes, a failed step appears, and the model reports the refusal in prose |
| 9 | Double-click **Allow once** rapidly | Only one `POST …/permission` is sent (the buttons disable on the first) |
| 10 | Wait 5 minutes without answering | Server-side the request times out. Expected on screen: some indication. **Observed:** the prompt silently vanishes when the timeout's `tool-result` arrives — no countdown, no warning, no way to extend → ♿ A11Y-copilot-admin-12 |
| 11 | Park a run, then answer from a second browser tab of the same session | The first tab's prompt is retired by the `tool-result` |
| 12 | Park a run, kill the server, click **Allow once** | The prompt **keeps its buttons** and shows "That answer did not reach the run — it may have already moved on." |
| 13 | Park a run in a collapsed window | The pill reads "— waiting for you" with an amber dot |

**Keyboard-only path:** with the caret in the composer, press **Shift+Tab**.
Expected: focus reaches the prompt's buttons. **Observed:** focus goes to the
model picker / paperclip first (they are later in the DOM than the transcript but
earlier than the composer's send), and the prompt is inside a scroller that may
have scrolled it out of view. Nothing moves focus to the prompt when it appears.
**Screen reader:** the prompt's insertion is announced only as an addition to the
`role="log"` — which by then is mid-flood from the streaming answer. See
♿ A11Y-copilot-admin-03.

### F50 / F51 / F52 — the composer

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Focus the box; it is two rows tall | — |
| 2 | Type six lines | It grows to ~152px then scrolls; the transcript above shrinks, it does not overflow |
| 3 | Delete back to one line | It **shrinks** again |
| 4 | Type a paragraph that wraps without newlines | It grows the same amount as typed newlines would |
| 5 | Press **Enter** | Sends; the box clears |
| 6 | Press **Shift+Enter** | Newline, no send |
| 7 | Switch to a Japanese IME, type `にほんご` and press Enter to commit the candidate | The candidate commits; **nothing is sent** |
| 8 | Press Enter again | Now it sends |
| 9 | Send, then look at the button | It is **Stop** (a square) with `aria-label="Stop"` |
| 10 | Press it | The stream halts and a quiet line "You stopped this answer." appears under the partial text — **not** a red alert |
| 11 | Send again immediately | It works; the button is not stuck on Stop |
| 12 | With the box empty | Send is disabled |
| 13 | While an upload is in flight | Send is disabled and the hint line reads "Waiting for uploads to finish…" |

### F53 – F57 — attachments

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Click the paperclip and pick a PNG | A chip appears immediately with a progress indicator, then settles |
| 2 | Send | The request body carries `attachments: [{assetId}]` only — no name, no size |
| 3 | Look at the sent turn | The chips render under the user bubble, in a list named **Attached files** |
| 4 | Look at the composer | Empty — files are cleared on send |
| 5 | Drag a file over the box | A dashed **Drop files to attach them** overlay appears **once** and does not flicker as the pointer crosses children |
| 6 | Drag out again | The overlay clears |
| 7 | Drop it | It stages and uploads |
| 8 | Copy an image and paste into the box | It attaches |
| 9 | Copy text and paste | The text pastes normally — the handler does not swallow it |
| 10 | Stage nine files | The ninth is refused and the hint line says so (announced, since it is `role="status"`) |
| 11 | Remove a chip | It leaves the turn; the asset is **still** in the Media Library |
| 12 | Upload a file the server rejects | The chip shows the failure and the send goes without it |
| 13 | Compare the two list names | Staged is **Files to send**; sent is **Attached files** |
| 14 | Render the composer on a surface passing no `attachments` prop | No paperclip at all |

### F58 – F62 — skills

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open the skills picker | `house-style` and `tone` listed; `tone` marked always-on |
| 2 | Stage `house-style` | A chip appears above the field with an `×` |
| 3 | Read the picker button's accessible name | It carries the **count**, and has no `aria-label` overriding it |
| 4 | Look at the always-on chip | A lock icon, **no** `×` |
| 5 | Send | The request body's `skills` contains **only** `house-style` — never `tone` |
| 6 | Look at the sent turn | Chips for **both**, in a list named **Skills used** |
| 7 | Send a second turn | `house-style` is **still** staged (unlike files) |
| 8 | Go to the CMS and come back to Agents | Still staged |
| 9 | Start a new chat | It inherits the staged set |
| 10 | Delete `house-style` from the manage page while it is staged | The chip disappears on the next catalogue refresh; the next turn does not fail |
| 11 | Remove every workspace skill and every code skill | The skills button is not rendered |

### F63 / F64 — the skills page

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | As admin, `…/agents/skills` | Code skills listed read-only; the workspace's own editable |
| 2 | Create one named "House Style" | The identifier is derived (`house-style`) and shown |
| 3 | Edit its **title** to "House Voice" | The identifier is **not** rewritten |
| 4 | Try a name a code skill holds | The server's 409 message is shown |
| 5 | Submit with a required field empty | The error is reported on submit; Save is **not** disabled |
| 6 | Delete one | A confirmation, then it is gone |
| 7 | As a contributor, visit the URL | No page; and the rail carries no link to it |

### F65 / F66 — attached context

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open a chat from `/workspaces/$WS/content/article/e42` | Above the composer: **+ Add context** |
| 2 | Confirm nothing is attached by default | The request body's `context.surface` is `chat` with no `contentType`/`entryId` |
| 3 | Click **+ Add context** | A chip naming the type, the entry and the locale |
| 4 | Send | The body carries `context: {surface:'entry', contentType:'article', entryId:'e42', …}` |
| 5 | Navigate to another entry | The chip still shows the **old** snapshot and the button re-offers the new page |
| 6 | Click the chip's `×` | Detached |
| 7 | Open a chat from `/workspaces/$WS/content/article/new` | `entryId` is **absent** — `new` is not an id |
| 8 | Same on `…/article/trash` | `entryId` absent |

### F67 — the markdown renderer

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Ask for a table of content types | It renders as a real `<table>` inside its own horizontally-scrolling box; the transcript does **not** scroll sideways |
| 2 | Inspect the `<th>` elements | **No `scope`**, no `<caption>`, no `aria-label` → ♿ A11Y-copilot-admin-08 |
| 3 | Ask the model to emit `<img src=x onerror=alert(1)>` inside an entry it reads back | It renders as **text**; no script runs, no element is created |
| 4 | Plant an entry containing `[click](javascript:alert(1))` and ask about it | The link is rendered without the `javascript:` href |
| 5 | Ask for a fenced code block | `<pre><code>` with its own horizontal scroll |
| 6 | Ask for an ordered and an unordered list | Real `<ol>` / `<ul>` |
| 7 | Ask for `# Heading` | Rendered as `<h3>` (offset by two) |

### F68 / F69 / F70 — errors

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Kill the API mid-answer | The partial text stays, and a destructive `Alert` **Something went wrong** appears under it in the transcript |
| 2 | With the window **open**, confirm no toast fires | The Toaster is bottom-right, exactly where the panel sits |
| 3 | Collapse the window and repeat | A `toast.error` fires — this is the one state it is for |
| 4 | Force a `max-steps` run | A **warning** `Alert` "This answer is incomplete — Stopped because it reached the maximum number of steps." |
| 5 | Switch the admin locale to `de` and repeat step 4 | Expected: German. **Observed:** the reason fragment is English → 🐞 BUG-copilot-admin-04 |
| 6 | Let the session expire, then send | "Your session has expired. Sign in again to continue." — not "Unauthorized" |
| 7 | Go offline and send | "Could not reach the server. Check your connection." |
| 8 | Press **Stop** | A quiet line, not a banner; in `de`, expected German. **Observed:** the literal "Stopped." → 🐞 BUG-copilot-admin-05 |

### F73 — sending while busy

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Send a question; while it streams, the button is **Stop** | — |
| 2 | Focus the box, type a second question and press **Enter** | The box does not clear and nothing is sent. Expected: some indication that the message was not queued. **Observed:** silence → 🐞 BUG-copilot-admin-06 |
| 3 | Repeat on the Agents view | Same |
| 4 | Now open the **same thread** in a dock window while it streams on the page | Not possible — the dock never draws a page-presented chat (checked and cleared) |

---

## 4. Edge Cases & Negative Paths

### Empty / zero

- **EC-01 — an empty transcript.** `✅ E2E` `a11y.spec.ts:29`,
  `agents-view.spec.ts:165`. The panel shows "Ask about the content in this
  workspace." plus the authority hint; the page shows the welcome.
- **EC-02 — zero conversations in the rail.** `✅ E2E` `agents-view.spec.ts`
  (the `empty` mock option). Confirm it is the empty state and **not** the error
  state — the BUGBOT "error masquerading as empty" pattern.
- **EC-03 — the list query fails.** `✅ E2E` `agents-view.spec.ts:79` — an
  `role="alert"` saying so, not "no chats".
- **EC-04 — zero skills.** `✅ E2E` `agents-skills.spec.ts:173` — no button.
- **EC-05 — zero models beyond one.** The picker hides. `❌ NONE`.
- **EC-06 — a proposal with `changes: null`.** `❌ NONE` — the card renders the
  header and badge with no `<dl>`. Verify it does not render an empty `<dl>`.
- **EC-07 — a tool result with `output: undefined`.** `❌ NONE` — `ToolStep`
  skips the Output payload (`ToolStep/index.tsx:117`).
- **EC-08 — a thread with `title: null`.** `✅ E2E` `dock.spec.ts:136` (pill),
  `agents-view.spec.ts:55` (filter). The top bar falls back to "Untitled chat".

### Boundary

- **EC-09 — exactly five conversations.** `❌ NONE` — the filter appears "past
  five"; confirm at 5 (hidden) and 6 (shown).
- **EC-10 — exactly three windows, then a fourth.** `✅ E2E` `dock.spec.ts:69`.
- **EC-11 — exactly eight attachments.** `⚠️ PARTIAL` — the ninth is covered
  (`agents-attachments.spec.ts:200`); the eighth is not.
- **EC-12 — `MAX_HEIGHT` exactly.** `⚠️ PARTIAL` — `agents-chat.spec.ts:114`
  asserts a ceiling; the shrink-back path is unasserted.
- **EC-13 — a title exactly at the rename DTO's 200 chars.** `❌ NONE`.
- **EC-14 — a session id counter at `chat-1000`.** `❌ NONE` — cosmetic, but the
  counter is never reset in the app (`copilotStore.ts:244` is test-only).
- **EC-15 — the dock at N pills wider than the viewport.** `❌ NONE` — it is
  `overflow-x-auto`; a keyboard user cannot scroll it (no `tabindex`), though
  Tab does move focus into off-screen pills, which scrolls them into view.

### Size & encoding

- **EC-16 — a 8 000-character message.** `❌ NONE` — the composer has no client
  cap, so the server's 400 is the first refusal. Confirm the failure is legible
  and the typed text is not lost.
- **EC-17 — RTL text in a message and a thread title.** `❌ NONE` — the user
  bubble is `whitespace-pre-wrap` with no `dir="auto"`; an Arabic question in a
  left-to-right layout renders with mixed punctuation placement.
- **EC-18 — emoji / ZWJ in a title.** `❌ NONE` — `summarize()`
  (`CopilotSession/index.tsx:126-131`) slices at 40 **UTF-16 units**, so a pill
  name can end in half a surrogate pair.
- **EC-19 — HTML/script in an entry title the model quotes back.** `⚠️ PARTIAL`
  — the mechanism (React elements, no `dangerouslySetInnerHTML`) is sound and
  documented, but nothing asserts it. `parseBlocks.spec.ts` tests the parser, not
  the renderer.
- **EC-20 — `[x](javascript:alert(1))` in a model answer.** `❌ NONE` — the
  scheme allow-list is in `renderInline` and untested.
- **EC-21 — a tool payload of 2 MB.** `❌ NONE` — `ToolStep`'s `<pre>` is
  `max-h-56 overflow-auto`, so it is bounded visually; `JSON.stringify` on 2 MB
  per step is a render cost nothing measures.
- **EC-22 — a filename with a path separator or an RTL override.** `❌ NONE` —
  `AttachmentChip` renders `name` verbatim.

### Permission matrix

Roles: `admin` / `contributor` / `viewer` / unauthenticated / member-of-another-workspace.

- **EC-23 — no `copilot:use`.** `✅ E2E` `agents-view.spec.ts:206`,
  `dock.spec.ts:58` — no page, no switcher, no dock.
- **EC-24 — `copilot:use` without `copilot:skills:manage`.** `✅ E2E`
  `skills-manage.spec.ts:176` — no rail link, no page.
- **EC-25 — a viewer.** `❌ NONE` in the admin suites. A viewer's copilot is
  read-only server-side, but the UI shows the same composer, the same skills
  picker and the same paperclip — and a viewer holds no `media:create`, so
  attaching fails at upload with an API error rather than the control being
  absent. Compare `Composer`'s own discipline of not rendering a control that
  fails (`packages/copilot/admin/AGENTS.md:752-753`). → 🐞 BUG-copilot-admin-07.
- **EC-26 — unauthenticated.** Handled by the shell's route guard; out of scope
  here.
- **EC-27 — permissions still loading.** `⚠️ PARTIAL` — `useHasPermission` is
  fail-closed, asserted only indirectly.

### Tenant isolation

- **EC-28 — an `agents/:id` URL from another workspace.** `⚠️ PARTIAL` —
  `agents-view.spec.ts:191` covers "a thread that will not open"; it does not
  distinguish a cross-workspace 404 from a network failure, and the copy
  ("The chat may have been removed, or the server could not be reached") merges
  them deliberately.
- **EC-29 — switching workspace with a chat open.** `❌ NONE` — the session is
  keyed `${workspaceId}:${session.id}` (`CopilotLauncher/index.tsx:122`), so the
  `CopilotSession` **remounts** on a workspace change while its chat state stays
  in the store under the old session id. Verify: does the run keep going with the
  old `X-Workspace-Id`, and does the remounted view show the same transcript?
  The key comment says the point is that an in-flight run must not get a new
  workspace id — worth proving, because the transcript lives outside the key.
- **EC-30 — the ViewSwitcher's `sessionStorage` key.** Per workspace
  (`ViewSwitcher/index.tsx:39`) — checked and cleared.

### Concurrency & state sync between the two surfaces

- **EC-31 — the same chat presented on the page and in the dock.**
  **Structurally impossible** — `dockSessions` filters `presented === 'dock'`
  (`sessions.ts:329-333`) and the page sets `presented: 'page'`. Checked and
  cleared: there is no "open both, send from one" divergence to hunt.
- **EC-32 — two windows on one `conversationId`.** `❌ NONE` → 🐞
  BUG-copilot-admin-01. The rail's path is guarded (`sessions.ts:163-180`); the
  panel's history dropdown is not.
- **EC-33 — two permission prompts answered from two windows on one thread.**
  `❌ NONE` — reachable only via EC-32, and then both `POST`s hit the same
  `runId:callId`; the second gets a 404 and the prompt says the answer did not
  land. Worth confirming rather than assuming.
- **EC-34 — sending while a run is in flight.** `❌ NONE` → 🐞
  BUG-copilot-admin-06.
- **EC-35 — Stop pressed twice.** `⚠️ PARTIAL` — `stop()` guards on there being
  a controller (`useCopilotChat.ts:298`); the guard is not exercised.
- **EC-36 — an abort landing after the chat was reloaded onto another thread.**
  `❌ NONE` — the `runController(sessionId) !== controller` guard
  (`useCopilotChat.ts:237,246`) is the fix for a real bug and has no test.
- **EC-37 — `awaiting` reported from an effect.** `🧪 UNIT` `sessions.spec.ts`
  (same-array bail-out). The render loop it prevents is not reproducible in a
  test.
- **EC-38 — closing a chat mid-permission-prompt.** `❌ NONE` — `abortRun`
  fires; the server's broker rejects its waiter. Confirm no console error and no
  orphaned toast.

### State after mutation

- **EC-39 — archiving invalidates the right key.** `✅ E2E`
  `agents-manage.spec.ts:99` — the "Archived" link appearing at all is the
  assertion, and it is the exact bug `conversationsScopeKey` fixed.
- **EC-40 — renaming does not reorder the rail.** `⚠️ PARTIAL` — server-side
  covered (`copilot-conversations.spec.ts:151`); the rail is not re-checked after
  a rename.
- **EC-41 — a turn lands while the rail is open.** `❌ NONE` — the list is
  invalidated in `finally` (`useCopilotChat.ts:274-276`); a new thread should
  appear under **Today** without a full reload.
- **EC-42 — over-invalidation.** Checked and cleared: only
  `conversationsScopeKey(workspaceId)` is invalidated, not the whole cache.
- **EC-43 — the panel's geometry after the window that owned a slot closes.**
  `⚠️ PARTIAL` — `dock.spec.ts:222` covers persistence; the slot-reuse hazard
  (`usePanelFrame` reading its key through a ref) is unasserted.

### Failure & partiality

- **EC-44 — the SSE body arrives as one chunk.** This is what `page.route`
  produces, so **every** admin-e2e chat assertion is about a *finished* turn.
  The progressive arrival of frames — and therefore everything about the
  streaming experience, including the live-region behaviour in §4A — is
  untestable in this harness. Stated in AGENTS.md:848-854 and worth repeating
  here.
- **EC-45 — a malformed SSE frame.** `❌ NONE` — `runStream` parses `data:` as
  JSON; a truncated frame's behaviour is unverified.
- **EC-46 — the stream ends with no `done`.** `❌ NONE` — the reducer keys "the
  turn is over" off `done`; the server always sends one, but a proxy cutting the
  connection does not. Expected: the `catch` fires and `failed` is dispatched.
  Verify `busy` clears.
- **EC-47 — network drop mid-run.** `❌ NONE` — `fetch` rejects with a
  `TypeError`, classified as offline. Verify the partial answer is kept.
- **EC-48 — the tab is backgrounded mid-run.** `❌ NONE` — no
  `requestAnimationFrame`-driven work is in the stream path, so it should
  continue, but the panel's open/close transition uses two rAFs
  (`CopilotPanel/index.tsx:237-244`) and a backgrounded tab does not fire them:
  a window opened while the tab is hidden stays at `opacity: 0` until the tab is
  foregrounded. Confirm it recovers.
- **EC-49 — navigating away mid-run.** `✅ E2E` `agents-chat.spec.ts:140`.
- **EC-50 — closing the browser tab mid-run.** By design the run dies; the
  server records `aborted`.
- **EC-51 — the upload endpoint 413s.** `✅ E2E` `agents-attachments.spec.ts:179`.

### Idempotency & replay

- **EC-52 — browser Back after archiving.** `❌ NONE`.
- **EC-53 — reload with a badge showing.** `❌ NONE` — `baseTitle` is captured
  at mount, so a reload re-captures the (unbadged) title correctly.
- **EC-54 — reopening a thread that is currently streaming in the dock.**
  `❌ NONE` — the rail's `open` focuses the existing session and the page adopts
  it; the transcript must not be re-fetched over the live one
  (`useAgentThread` disables the query when the chat is already on the thread).

### UI-specific

- **EC-55 — loading vs error vs empty are three states.** `✅ E2E` for the rail
  (`agents-view.spec.ts:29,79` + the empty mock) and the thread
  (`agents-view.spec.ts:191` for failed, the skeleton for loading).
- **EC-56 — the loading skeleton is `aria-hidden`.** Checked
  (`AgentsThread/index.tsx:143`) — correct, but it means a screen-reader user
  gets **no** loading announcement at all. See ♿ A11Y-copilot-admin-14.
- **EC-57 — focus after the rename dialog closes.** `✅ E2E`
  `agents-manage.spec.ts:82`.
- **EC-58 — focus after a window minimizes.** `❌ NONE` → 🐞 BUG-copilot-admin-02.
- **EC-59 — an i18n message for every branch.** `⚠️ PARTIAL` — three literals
  escape `defineMessages`; see 🐞 BUG-copilot-admin-04 / -05.
- **EC-60 — the transcript auto-scroll.** `❌ NONE` — `scrollIntoView` fires on
  every `turns` change (`MessageList/index.tsx:93-95`), i.e. **on every text
  delta**, and it is unconditional: a user who has scrolled up to read an earlier
  turn is yanked back to the bottom on the next token. There is no "am I at the
  bottom?" check. Also `behavior` is default (`auto`), so this is not itself a
  reduced-motion problem, but it is a usability one and a
  focus-context one. → 🐞 BUG-copilot-admin-03.

---

### 4A. Accessibility & Section 508 Conformance

**Standards.** Revised Section 508 (36 CFR Part 1194) incorporates **WCAG 2.0
A + AA** by reference (E205.4 for electronic content; 504.2 for authoring
tools). This repo's `accessibility` skill targets **WCAG 2.1 AA**, so findings
below cite the 2.1 SC and the 508 provision. Chapter 5 provisions assessed:
502.2/502.3 (name, role, state, value exposed **and kept current**), 503.2
(platform preferences — reduced motion), 503.4 (n/a — no audio/video), 504
(authoring tools — see `docs/testing/copilot-server.md` §4A for the write path;
the UI half is A11Y-copilot-admin-15 below).

**Do not trust axe.** This unit has the best axe coverage of any copilot package
(`apps/admin-e2e/src/copilot/a11y.spec.ts`, plus scans in `dock.spec.ts:299-340`,
`agents-skills.spec.ts:185`, `agents-attachments.spec.ts:316`,
`skills-manage.spec.ts:208`). It still proves very little here, for four
specific reasons:

1. **The harness runs only `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`**
   (`apps/admin-e2e/src/support/fixtures.ts:110-116`). Axe tags
   `heading-order` and `page-has-heading-one` as **`best-practice`**, so neither
   runs — which is why A11Y-copilot-admin-07 is invisible to a green suite.
   Nothing is *disabled* in `support/a11y.ts`, which is good; the gap is the tag
   filter, not a suppression list.
2. **`expectNoA11yViolations` discards axe's `incomplete` results**
   (`apps/admin-e2e/src/support/a11y.ts:13` reads only `violations`). A
   semi-transparent foreground over an unknown background is exactly what axe
   reports as *incomplete* rather than *violation* — see
   A11Y-copilot-admin-10.
3. **No scan covers the permission prompt, a failed step, a failed change card,
   the mobile Chats sheet, or the truncated-run warning.** An axe scan of a page
   whose prompt is not rendered says nothing about the prompt.
4. **Streaming cannot be scanned.** The `page.route` mock delivers the whole SSE
   body in one read (AGENTS.md:848-854), so no scan and no test ever observes the
   transcript *while it is changing* — which is where the single worst finding in
   this unit lives.

Verdict summary: **1 Does Not Support ×5 · Partially Supports ×8 · Not
Applicable ×2.**

---

#### ♿ A11Y-copilot-admin-01 — streaming tokens flood an `aria-live="polite"` log, making a screen reader unusable during an answer

**WCAG 2.1 SC:** 4.1.3 Status Messages (AA); knock-on 2.2.1
**508 provision:** E205.4; 502.3.10 (Modification of Text)
**Verdict:** **Does Not Support**
**Location:** `packages/copilot/admin/src/lib/presentation/MessageList/index.tsx:108-114`
with `packages/copilot/admin/src/lib/application/chatReducer.ts` (the
`text-delta` merge).

```tsx
<div
    className="flex-1 overflow-y-auto px-4 py-4"
    role="log"
    aria-label={intl.formatMessage(messages.transcript)}
    aria-live="polite"
>
```

**What happens.** `role="log"` already carries an implicit `aria-live="polite"`;
it is stated explicitly here as well. `aria-atomic` defaults to `false` and
`aria-relevant` to `additions text`, so **every text change inside the region is
queued for announcement**. A `text-delta` frame arrives dozens to hundreds of
times per answer and the reducer appends each one to the last text block, so the
subtree mutates on every token. NVDA and VoiceOver both re-announce the changed
text node on each mutation; JAWS coalesces some but not all.

**What a screen-reader user experiences.** From the first token to the last, the
speech queue is saturated with fragments of a sentence being re-read as it grows
("Setting", "Setting the", "Setting the summ…"), and — critically — **nothing
else can be announced while that is happening**, including the permission prompt
(A11Y-copilot-admin-03) and the tool steps. The correct behaviours are the two
extremes and both are wrong: no announcement at all leaves a blind user with no
idea an answer arrived; this leaves them unable to use the browser.

**What a keyboard-only user experiences.** No direct effect, but see
🐞 BUG-copilot-admin-03 — the same code auto-scrolls on every delta.

**Repro:** with NVDA or VoiceOver running, open a chat and ask anything against a
real (streaming) provider. The mocked e2e harness will not reproduce it, because
it delivers the whole body at once.

**Remediation.** Make the transcript `aria-live="off"` (keeping `role="log"` for
navigation) and add a **separate, debounced** `role="status"` region that
announces once per completed turn — the answer's first sentence plus "answer
complete", and each tool step's finished phrase. Announce the permission prompt
through `role="alertdialog"` or an `assertive` region instead of relying on the
log.

---

#### ♿ A11Y-copilot-admin-02 — transcript turns are not speaker-labelled; who said what is conveyed by colour and alignment alone

**WCAG 2.1 SC:** 1.3.1 Info and Relationships (A), 1.4.1 Use of Colour (A)
**508 provision:** E205.4; 502.3.1 (Object Information)
**Verdict:** **Does Not Support**
**Location:** `MessageList/index.tsx:152-201` (user turn) and `:203-296`
(assistant turn).

**What happens.** A user turn is a right-aligned `<div>` with
`bg-primary text-primary-foreground`; an assistant turn is a left-aligned
`<div>` of markdown. There is no `<article>`, no heading, no `aria-label`, no
visually-hidden "You said" / "Ortha AI said", and no `role="listitem"`. The only
signals are **fill colour** and **alignment**.

**Screen-reader experience.** Reading a five-turn thread back linearly produces
an undifferentiated wall of prose in which questions and answers cannot be told
apart — which for a copilot transcript is the whole content. This is also why
the `role="log"` is of little help: a log with unlabelled entries is a log you
cannot navigate.

**Keyboard-only experience.** Unaffected.

**Repro:** open any thread with three or more turns and read it with a screen
reader in browse mode.

**Remediation.** Wrap each turn in an `<article>` with an accessible name
("You", "Ortha AI") — or a visually-hidden `<h3>` — so the turns become
navigable landmarks, and pair the alignment/colour with that text so the role is
not colour-only.

---

#### ♿ A11Y-copilot-admin-03 — the consent gate is not focused, not announced urgently, and reachable only by tabbing backwards into a scrolling log · also 🔒

**WCAG 2.1 SC:** 4.1.3 Status Messages (AA), 2.4.3 Focus Order (A), 3.3.2 Labels or Instructions (A)
**508 provision:** E205.4; 502.3.5 (Modification of Values)
**Verdict:** **Does Not Support**
**Location:** `packages/copilot/admin/src/lib/presentation/PermissionPrompt/index.tsx:72-141`,
rendered from `MessageList/index.tsx:230-240`.

**What happens.** The prompt is a `<section aria-label="Ortha AI wants to change
your content">` inserted into the transcript. Nothing moves focus to it. It has
no `role="alertdialog"`, no `aria-live="assertive"` of its own, and its buttons
are not associated with the `<pre>` showing the arguments (no
`aria-describedby`). Its only announcement path is the parent `role="log"`,
which by that point in a run is saturated (A11Y-copilot-admin-01).

**Why it is more than a nuisance.** This prompt *is* the security control
ADR-0009 §1b buys back — the one place a prompt-injected write is stopped before
anything happens. A consent control a screen-reader user cannot perceive, and a
keyboard user has to hunt for, is a consent control that gets answered blind or
not at all. That makes this **both** ♿ and 🔒.

**Keyboard-only experience.** The caret is in the composer when the prompt
appears. Shift+Tab reaches the composer's own controls first (send, skills,
paperclip, model picker are all after the transcript in the DOM but inside the
composer's box). Getting to **Allow once** means several backward tabs into a
scroller whose contents are still moving.

**Screen-reader experience.** In the best case, one polite announcement of the
whole section, queued behind however many token fragments are already in front
of it. In the ordinary case, nothing audible until the user happens to navigate
there.

**Repro:** ask for a write with a screen reader running; count how long between
the run parking and any indication.

**Remediation.** Move focus to the prompt's primary button when it appears (it
is a modal *decision* even though it is deliberately not a modal *dialog*),
give the section `role="group"` + an `aria-describedby` pointing at the
arguments, and announce it through an `assertive` region — not through the
transcript log.

---

#### ♿ A11Y-copilot-admin-04 — Escape collapses the window and drops focus on `<body>`

**WCAG 2.1 SC:** 2.4.3 Focus Order (A)
**508 provision:** E205.4; 502.3.12 (Focus Cursor)
**Verdict:** **Does Not Support**
**Cross-reference:** 🐞 BUG-copilot-admin-02 — the functional defect is filed
there with the code; the accessibility consequence is that a keyboard-only user
who dismisses a window is returned to the top of the document and must re-tab
through the entire page to reach anything, including the dock they just
collapsed into.

---

#### ♿ A11Y-copilot-admin-05 — three simultaneous dialogs share one accessible name

**WCAG 2.1 SC:** 4.1.2 Name, Role, Value (A), 2.4.6 Headings and Labels (AA)
**508 provision:** 502.3.1 (Object Information)
**Verdict:** **Partially Supports**
**Location:** `packages/copilot/admin/src/lib/presentation/CopilotPanel/index.tsx:279-284`

```tsx
<div
    role="dialog"
    aria-label={intl.formatMessage(messages.title)}   // always "Ortha AI"
```

The visible `<h2>` two elements below uses `title ?? messages.title`
(`:360-362`), so the window's *visible* name distinguishes it and its
*accessible* name does not. With the cap at three, a screen-reader user
enumerating dialogs hears "Ortha AI, dialog" three times. This is the exact
ambiguity the package already fixed for dock pills ("An untitled pill is
'Untitled chat', never 'New chat'", AGENTS.md:417-420) — unfixed one component
over.

**Remediation.** Point `aria-labelledby` at the `<h2>`, which already holds the
thread title, and drop the `aria-label`.

---

#### ♿ A11Y-copilot-admin-06 — `role="toolbar"` promises a keyboard model the dock does not implement

**WCAG 2.1 SC:** 4.1.2 Name, Role, Value (A); knock-on 2.4.3
**508 provision:** 502.3.1, 502.3.14 (Event Notification)
**Verdict:** **Partially Supports**
**Location:** `packages/copilot/admin/src/lib/presentation/CopilotDock/index.tsx:88-101`

```tsx
// `toolbar`, so a screen reader announces it as one control group
// and arrow-key conventions apply, rather than reading a loose row
// of buttons floating over the page.
role="toolbar"
aria-orientation="horizontal"
```

The comment states the intent exactly. The implementation does not deliver it:
every child is a plain `<button>` with the default `tabindex`, there is no
roving-tabindex management and no `onKeyDown` handling `ArrowLeft`/`ArrowRight`.
Per the WAI-ARIA APG a toolbar is a **composite** widget with one tab stop and
arrow-key navigation inside it. Declaring the role without the behaviour means a
screen-reader user is told to press arrows and nothing happens, while a
keyboard-only user gets `2N + 1` tab stops in a floating bar on every page of the
admin.

**Repro:** open three chats, Tab until the first pill has focus, press
**→**. Nothing moves.

**Remediation.** Either implement the roving tabindex, or drop the role to a
plain `<div aria-label="Ortha AI chats">` (a group), which is honest about what
it is.

---

#### ♿ A11Y-copilot-admin-07 — no `<h1>` anywhere; headings start at `<h2>`/`<h3>` and the axe suite cannot see it

**WCAG 2.1 SC:** 1.3.1 Info and Relationships (A), 2.4.6 Headings and Labels (AA)
**508 provision:** E205.4
**Verdict:** **Does Not Support**
**Location:** `AgentsPage/index.tsx:81-100` (no `ContainerHeader`, no heading);
first headings are `AgentsWelcome/index.tsx:88` (`<h2>`),
`AgentsRailList/index.tsx:322` (`<h3>`), `CopilotPanel/index.tsx:360` (`<h2>`),
and `Markdown/index.tsx:48` (model output starts at `<h3>`).

The `accessibility` skill is explicit: "One `<h1>` per page, via
`ContainerHeader`'s `title`". The Agents view is a full route and renders none —
its only textual identity is a `BreadcrumbPage` in the top bar
(`AgentsTopBar/index.tsx:107-109`), which is not a heading. The docked panel is
portalled to `<body>`, so its `<h2>` sits in a subtree with no `<h1>` above it at
all.

**Why the suite is green anyway.** Axe classifies `page-has-heading-one` and
`heading-order` as `best-practice`, and the fixture requests only
`wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa`
(`apps/admin-e2e/src/support/fixtures.ts:110-116`). Neither rule ever runs.

**Screen-reader experience.** Pressing `H` to jump by heading, or `1` for the
top-level heading, finds nothing on the Agents view; the rail's date buckets are
the first headings encountered, which suggests the page is *about* dates.

**Remediation.** Give the Agents view an `<h1>` (visually hidden if the design
does not want one), demote the rail's buckets, and add `best-practice` — or at
least `heading-order` and `page-has-heading-one` — to the axe tag list.

---

#### ♿ A11Y-copilot-admin-08 — model-generated tables have no header scope, no name, and a scroll region a keyboard cannot reach

**WCAG 2.1 SC:** 1.3.1 (A), 2.1.1 Keyboard (A), 1.4.10 Reflow (AA — partially met)
**508 provision:** E205.4; 502.3.1
**Verdict:** **Does Not Support**
**Location:** `packages/copilot/admin/src/lib/presentation/Markdown/index.tsx:62-105`

```tsx
<div className="border-border overflow-x-auto rounded-md border">
    <table className="w-full border-collapse text-xs">
        <thead className="bg-muted/50">
            <tr …>
                {block.header.map((cell, index) => (
                    <th key={index} className="…" style={{ textAlign: … }}>
```

Three gaps: the `<th>` carries **no `scope="col"`**, the `<table>` has **no
`<caption>` and no accessible name**, and the `overflow-x-auto` wrapper has no
`tabindex="0"` so a keyboard-only user cannot scroll a wide table sideways. The
`accessibility` skill states all three requirements for the design-system
`Table`; this hand-rolled one meets none. Tables were added to this renderer
because a content-type table was the first real-use gap — so they are not a rare
case.

**Screen-reader experience.** In table-navigation mode, moving between cells
announces no column header, so a 6-column content-type table reads as bare
values.

**Remediation.** Add `scope="col"`, give the table an `aria-label` (or move to
`react-markdown` + the design-system `Table`, which the AGENTS.md already names
as the escape hatch), and put `tabindex={0}` + `role="region"` on the scroll
wrapper.

---

#### ♿ A11Y-copilot-admin-09 — `prefers-reduced-motion` is honoured on the panel and nowhere else

**WCAG 2.1 SC:** 2.3.3 Animation from Interactions (AAA — advisory)
**508 provision:** **503.2 Platform Preferences** (this is the binding one)
**Verdict:** **Partially Supports**
**Location:** honoured at `CopilotPanel/index.tsx:339`
(`motion-reduce:transition-none`). **Not** honoured at:

| Element | Where | Motion |
| --- | --- | --- |
| "Thinking…" | `MessageList/index.tsx:256` | `animate-pulse`, continuous, for the whole time the model is thinking |
| Tool-step spinner | `ToolStep/index.tsx:131` → `Spinner` | `animate-spin`, continuous per running step |
| Permission-prompt spinner | `PermissionPrompt/index.tsx:134` | `animate-spin` |
| Tool-step chevron | `ToolStep/index.tsx:79` | `transition-transform` on expand |
| Dock pill / new-chat | `CopilotDock/index.tsx:130,176` | `transition-colors` (low risk) |
| Composer box | `Composer/index.tsx:264` | `transition-colors` (low risk) |

503.2 requires a platform's accessibility setting to be respected by software
that has a corresponding feature; the package already demonstrates it knows how.
`animate-pulse` on an indeterminate indicator that runs for the full duration of
a model call is the one most likely to affect a vestibular-sensitive user.

**Remediation.** Add `motion-reduce:animate-none` to the pulse and the spinners
(pairing the spinner with a static state), and `motion-reduce:transition-none`
to the chevron.

---

#### ♿ A11Y-copilot-admin-10 — a tinted token on the view switcher, in the one place the package already documented as a contrast trap

**WCAG 2.1 SC:** 1.4.3 Contrast (Minimum) (AA)
**508 provision:** E205.4
**Verdict:** **Partially Supports — needs manual measurement**
**Location:** `packages/copilot/admin/src/lib/presentation/ViewSwitcher/index.tsx:136`
and `:143`

```tsx
className="text-sidebar-foreground/70 hover:text-sidebar-foreground …"
```

The package's own AGENTS.md (lines 227-230) sets out the rule: "The group
headings use the full `text-muted-foreground`, **not** an opacity of it. `/80` at
10px is a serious contrast failure … the token is the one that was verified
against AA, so tinting it further is undoing that check by hand." The inactive
segment of the CMS/Agents switcher tints `text-sidebar-foreground` to **70%**,
which is a harder tint than the `/80` the same document rejects. The text is
small (`text-xs` in the sidebar's sizing).

**Why axe has not caught it.** `color-contrast` *is* a `wcag2aa` rule and does
run — but a semi-transparent foreground over the sidebar's own tinted background
(`bg-sidebar-accent/40`) is a case axe reports as **`incomplete`**, and
`expectNoA11yViolations` reads only `violations`
(`apps/admin-e2e/src/support/a11y.ts:13`). The result is discarded, not passed.

**Remediation.** Measure the composed pair in both themes with a contrast tool;
if it is under 4.5:1, use the full token and distinguish the inactive segment by
weight or background instead. Separately, make the harness fail (or at least
report) on `incomplete`.

---

#### ♿ A11Y-copilot-admin-11 — bare `Spinner`s are unnamed `role="status"` regions, and step status is icon + colour only

**WCAG 2.1 SC:** 4.1.2 Name, Role, Value (A), 1.4.1 Use of Colour (A)
**508 provision:** 502.3.1, 502.3.3 (Row, Column, and Headers — n/a), 502.3.14
**Verdict:** **Partially Supports**
**Location:** `ToolStep/index.tsx:129-137`, `PermissionPrompt/index.tsx:133-137`;
the primitive is `packages/design-system/src/lib/components/ui/spinner.tsx`.

The design-system `Spinner` renders `role="status"` and its own JSDoc says
"Inside a button, pair it with an `sr-only` label so the busy state is
announced." Neither caller does. Two consequences:

- **A nameless live region per running step.** Every `<ToolStep>` in the running
  state mounts an empty `role="status"` inside the already-live transcript,
  adding N more live regions to the flood in A11Y-copilot-admin-01.
- **No busy announcement on the consent button.** Clicking **Allow once**
  disables all three buttons and swaps the check for a spinner; a screen-reader
  user hears the buttons become unavailable with no explanation.

Separately, `StatusIcon` returns `CircleAlert` (`text-destructive`) or
`CircleCheck` (`text-emerald-600`) with **no accessible name and no
`aria-hidden`**, so success/failure of a step is carried by icon shape and colour
only — the summary text (`ToolStep/index.tsx:87-90`) prints the tool's own
one-liner and falls back to "Failed" *only when there is no summary*, so a failed
step that returned a summary says nothing about having failed.

**Remediation.** `aria-hidden` the status icons and add an `sr-only` word
("Succeeded"/"Failed"/"Running"); give each `Spinner` an `sr-only` label.

---

#### ♿ A11Y-copilot-admin-12 — a five-minute consent timeout with no warning, no countdown and no way to extend

**WCAG 2.1 SC:** 2.2.1 Timing Adjustable (A)
**508 provision:** E205.4
**Verdict:** **Does Not Support**
**Location:** the limit is
`packages/copilot/server/src/lib/chat/application/tool-permission.broker.ts:13`
(`DECISION_TIMEOUT_MS = 5 * 60_000`); the UI that must surface it is
`packages/copilot/admin/src/lib/presentation/PermissionPrompt/index.tsx:72-141`,
which shows no time at all.

2.2.1 requires that, where a time limit is set by the content, the user can turn
it off, adjust it to ten times the default, or **extend it after a warning with
at least 20 seconds' notice**. None of the exceptions apply: this is not a
real-time event, not an auction, not essential (ADR-0009 justifies the limit as
cost, not correctness), and it is far under 20 hours.

**What a user experiences.** The prompt simply disappears and a failed step
appears in its place, with the model reporting that "nobody answered". For a
screen-reader user who did not perceive the prompt in the first place
(A11Y-copilot-admin-03), the only evidence a decision was ever asked for is the
failure. For anyone using a screen magnifier or switch access, five minutes to
read a JSON argument block, decide, and click is not generous.

**Remediation.** Show the remaining time, warn at 20 seconds with an assertive
announcement, and offer an "I need more time" control that re-arms the broker's
timer — or make the timeout configurable and default it much higher, since the
cost it protects against (a held connection) is the operator's, not the user's.

---

#### ♿ A11Y-copilot-admin-13 — the SPA route is never in the document title, and the title is used for a badge instead

**WCAG 2.1 SC:** 2.4.2 Page Titled (A)
**508 provision:** E205.4
**Verdict:** **Partially Supports**
**Location:** `packages/copilot/admin/src/lib/application/useTabBadge.ts:32-37`

Navigating to `/workspaces/:id/agents`, opening a thread, and opening the skills
page all leave `document.title` unchanged — the only thing this package writes to
it is the unread count. A screen-reader user who switches tabs cannot tell which
part of the admin they are in. This is a shell-wide gap rather than one this
package created (see `docs/testing/shell-admin.md`), but this package is the one
that *writes* the title, so any fix has to compose with `badgedTitle`.

**Remediation.** Set a route title (`Ortha AI — {thread}`) and have `badgedTitle`
prefix whatever the route set, re-reading the base on every route change rather
than capturing it once.

---

#### ♿ A11Y-copilot-admin-14 — loading and "thinking" states are hidden from assistive tech

**WCAG 2.1 SC:** 4.1.3 Status Messages (AA)
**508 provision:** E205.4
**Verdict:** **Partially Supports**
**Location:** `AgentsThread/index.tsx:140-148` (`aria-hidden` skeleton),
`MessageList/index.tsx:248-259` ("Thinking…").

The thread skeleton is correctly `aria-hidden` — but nothing replaces it, so
opening a thread announces nothing until the transcript lands. "Thinking…" sits
inside the flooding `role="log"`, so it is either drowned or (once the log is
fixed per A11Y-copilot-admin-01) silent. Both are the *other* half of the 4.1.3
failure: A11Y-copilot-admin-01 announces far too much, and these announce
nothing.

**Remediation.** A single polite `role="status"` outside the transcript carrying
the current phase: "Loading conversation", "Thinking", "Searching content",
"Answer complete".

---

#### ♿ A11Y-copilot-admin-15 — 504 Authoring Tools: the change card is the only accessibility review point, and it reviews nothing

**WCAG 2.1 SC:** 1.1.1 (A) — of the *produced content*
**508 provision:** **504.3 (Prompts)**, 504.2
**Verdict:** **Does Not Support**
**Location:** `ProposalCard/index.tsx:72-141`; cross-reference
♿ A11Y-copilot-server-02 in `docs/testing/copilot-server.md`.

OrthaCms is an authoring tool, and this UI is where an author sees what an agent
wrote to their content. Since ADR-0009 the card is a **receipt**, not a review —
so there is no point at which the tool prompts for alt text, checks that a
proposed richtext body uses real headings, or flags a media field with no `alt`.
The permission prompt shows raw JSON arguments, which is a security disclosure
rather than an accessibility one, and "Allow for this chat" removes even that.

**Remediation** belongs mostly on the server (see that artifact), but the UI half
is worth stating: when a proposal touches a media field or a richtext body, the
card should surface the accessibility-relevant part of the diff — the `alt` that
was or was not set — rather than only the fields the model named.

---

#### Not Applicable

- **503.4 (captions / audio controls)** — no media playback.
- **1.4.4 Resize Text / 1.4.12 Text Spacing** — no fixed-height text containers
  found; the composer measures rather than counts rows
  (`Composer/index.tsx:174-181`), which is the right shape for 1.4.12.

#### Checked and cleared

- **1.4.10 Reflow.** `clampFrame` clamps a dragged window's width and height into
  the viewport (`panelFrame.ts:56-70`), and an un-dragged window carries
  `max-w-[calc(100vw-2rem)]` (`CopilotPanel/index.tsx:316`). The markdown table
  and code block scroll inside their own containers rather than the page.
- **2.1.2 No Keyboard Trap.** The panel is deliberately not focus-trapped; the
  mobile Sheet is a real Radix modal and releases on Escape.
- **`aria-hidden-focus`.** Both dropdown menus are opened with `modal={false}`
  precisely so the open menu does not `aria-hidden` the page root
  (`ModelPicker/index.tsx:69-70`, `ConversationPicker/index.tsx:59-60`,
  `AgentsRailRow/index.tsx:114-116`) — the right call, and documented.
- **Icon-only controls are named.** Paperclip, remove-chip, close-pill,
  row-actions, resize corner, move grip, and every panel header button carry an
  `aria-label` (`Composer:350`, `AttachmentChip:149`, `CopilotDock:158`,
  `AgentsRailRow:128`, `PanelResizeHandles:105`, `CopilotPanel:427,463`).
- **Decorative icons are hidden.** `ViewSwitcher:138,145`, `AttachmentChip:162`,
  `AgentsWelcome:118`, `AgentsRailList:259`, and the dock's marker dot
  (`CopilotDock:140`).
- **Seven of eight resize strips are `aria-hidden` and pointer-only**, so a
  keyboard user passing through a non-modal surface does not collect eight extra
  tab stops (`PanelResizeHandles:78-94`) — a genuinely good decision.
- **The disabled-submit anti-pattern is avoided** where it matters: the rename
  dialog's Save stays enabled on an invalid name
  (`agents-manage.spec.ts:45`), and the skills form reports on submit
  (`skills-manage.spec.ts:158`).
- **Two lists, two names.** "Files to send" vs "Attached files"; "Skills for this
  chat" vs "Skills used" — both were real ambiguities, both fixed, both tested.
- **The skills button carries its count in the accessible name and has no
  overriding `aria-label`** (`SkillPicker:155`, `agents-skills.spec.ts:74`).
- **`aria-current="page"` on the open rail row** (`AgentsRailRow:103`,
  `agents-view.spec.ts:99`).
- **The composer hint is a `role="status"`** carrying the count refusal and the
  upload wait (`Composer:391-408`) — the right mechanism, correctly scoped.

---

## 5. E2E Coverage Map

Read from `apps/admin-e2e/src/copilot/` (nine spec files, 1 859 lines) and the
package's own jest suites.

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F2 gating | `dock.spec.ts:58`; `agents-view.spec.ts:206`; `skills-manage.spec.ts:176` | no dock outside a workspace; no page/switcher without `copilot:use`; no skills page/link without the manage permission | ✅ E2E |
| F3 ⌘J | `dock.spec.ts:47` | the shortcut opens a chat | ⚠️ PARTIAL — no case for the shortcut being inert outside a workspace, and none for `Ctrl+J` |
| F4 dock as entry point | `dock.spec.ts:31` | the button opens a window focused on the composer | ✅ E2E |
| F5 pill toggling | `dock.spec.ts:92` | toggles, and `aria-pressed` says which state | ✅ E2E |
| F6 markers | `dock.spec.ts:160` | a run finishing off screen marks the pill **and the tab** | ⚠️ PARTIAL — only `unread`. `awaiting` ("— waiting for you") — the higher-priority marker, and the one the whole permission feature depends on — has **no** coverage |
| F7 close | `dock.spec.ts:122` | discards the chat and hands focus to the dock | ✅ E2E |
| F8 tab badge | `dock.spec.ts:160`; 🧪 `tabBadge.spec.ts` | count on the title; base title captured once | ✅ E2E |
| F9 window cap | `dock.spec.ts:69`; 🧪 `sessions.spec.ts` | three tile, a fourth collapses the oldest | ✅ E2E |
| F10 move | `dock.spec.ts:222,262` | drag persists across reopen; arrow keys move a focused window | ✅ E2E |
| F11 resize | — | — | ❌ NONE. Eight strips, one of them keyboard-operable, and no spec touches any of them. The arithmetic is unit-tested (`panelFrame.spec.ts`); the wiring is not |
| F12 Expand/Shrink | `dock.spec.ts:200,248` | one control relabelled; Expand recovers a bad drag | ✅ E2E |
| F14 Escape | `dock.spec.ts:109` | collapses, does not close | ⚠️ PARTIAL — nothing asserts where focus lands afterwards → 🐞 BUG-copilot-admin-02 |
| F15 non-modal | `dock.spec.ts:316,325` | axe clean with one and three windows over the page | ⚠️ PARTIAL — axe cannot answer "is the page behind still operable"; no spec Tabs out of the panel or clicks the page behind it |
| F16 focus on open | `dock.spec.ts:31` | the composer has focus | ✅ E2E |
| F18 focus on minimize | — | — | ❌ NONE |
| F19 history dropdown | `dock.spec.ts:185` | opens a saved thread | ⚠️ PARTIAL — the duplicate-window hazard AGENTS.md:882-889 calls a known defect is not asserted in either direction |
| F20 model picker | `dock.spec.ts:278`; `agents-chat.spec.ts:87`; 🧪 `useCopilotModels.spec.ts` | survives a collapse; survives a trip through the CMS; sent on the wire | ✅ E2E |
| F21/F22/F23 the URL is the thread | `agents-chat.spec.ts:27,63`; `agents-view.spec.ts:145`; 🧪 `agentsRoute.spec.ts` | promotes the URL mid-run without interrupting; Back moves between threads; New chat does not bounce back | ✅ E2E — the strongest block in the suite |
| F24/F25 rail grouping + filter | `agents-view.spec.ts:29,55`; 🧪 `groupConversations.spec.ts` | recency headings; filter; untitled matches nothing | ✅ E2E |
| F26 `aria-current` | `agents-view.spec.ts:99` | announces which thread is current | ✅ E2E |
| F27/F29 row menu + rename | `agents-manage.spec.ts:26,45,65,82` | rename propagates to rail **and** bar; blank name gives a reason not a dead button; server refusal shown; focus returns to the row | ✅ E2E — including the focus-return bug that needed a browser to find |
| F28 no delete | `agents-manage.spec.ts:160` | the menu offers no way to destroy a thread | ✅ E2E |
| F30/F31 archiving | `agents-manage.spec.ts:99,123,143` | archive → the link appears; restore; archiving the open thread starts a new chat | ✅ E2E |
| F32 mobile sheet | — | — | ❌ NONE. No spec sets a viewport under `md`, so the entire mobile navigation path — including its focus trap and restore — is unexercised |
| F33/F34 switcher | `view-switcher.spec.ts:26,48,65,85` | says which view; returns to the page you left; re-clicking is not a third state; the dock stands down | ✅ E2E |
| F35 welcome | `agents-view.spec.ts:165`; axe `a11y.spec.ts:29` | openers ask; axe clean | ✅ E2E |
| F36 run outlives the page | `agents-chat.spec.ts:140` | becomes a pill and says so | ✅ E2E |
| F37 `release` rules | — | the `awaiting` branch | ⚠️ PARTIAL |
| F38/F39 block order | `agents-chat.spec.ts:27`; `agents-view.spec.ts:119`; 🧪 `chatReducer.spec.ts:104-175` | order live **and** reopened; a step starts a new paragraph | ✅ E2E |
| F40 tool step | `a11y.spec.ts:48`; 🧪 `labels.spec.ts` | the expanded step is axe-clean; both tenses resolve | ⚠️ PARTIAL — the two tenses are unit-tested, never rendered mid-run (the mock delivers a finished turn) |
| F41 "Thinking…" between steps | — | — | ❌ NONE — untestable in this harness (EC-44) |
| F42 failed step | 🧪 `chatReducer.spec.ts` | `ok:false` folds to `status: 'error'` | ⚠️ PARTIAL — never rendered; the "green tick beside the word failed" bug this fixed would not be caught again by a test |
| F43/F44/F45 change cards | `a11y.spec.ts:39`; `dock.spec.ts:333`; `agents-view.spec.ts:119`; 🧪 `chatReducer.spec.ts:490-542` | a card renders and is axe-clean; reopened threads reattach; the failure reason is kept | ⚠️ PARTIAL — **only the `accepted` card is ever rendered.** The mock's `runBody` hard-codes `status: 'accepted'` (`apps/admin-e2e/src/support/api/copilot.ts:337`), so the **Not saved** presentation — the one that tells a user their content did *not* change — has never been drawn in a browser |
| F46/F47/F48 permission prompt | 🧪 `chatReducer.spec.ts:393-462` | attaches, flags in-flight, retires on answer, keeps buttons on failure, retires on a tool result, ignores an unknown call id | ❌ NONE in a browser. `grep -r 'tool-permission-request\|PermissionPrompt' apps/admin-e2e/src` returns **nothing**: the mock never emits the frame, no POM exposes the prompt, and no axe scan includes it. The reducer is well covered; **the consent UI is not covered at all** |
| F49 `awaiting` state | 🧪 `sessions.spec.ts` | same array on no change | ❌ NONE end-to-end |
| F50 composer growth | `agents-chat.spec.ts:114` | grows to a ceiling | ⚠️ PARTIAL — no shrink-back case |
| F51 Enter / IME | — | Enter is used implicitly everywhere | ⚠️ PARTIAL — no IME composition case, and that guard is what stops CJK users sending half a word |
| F52 Stop | `agents-chat.spec.ts:162` | leaves a note rather than an error | ✅ E2E — this is the spec that found the "button stuck on Stop" bug |
| F53-F57 attachments | `agents-attachments.spec.ts:41,68,89,114,128,149,179,200,226,245,262,277,299,316` | stage, clear on send, render on the turn, redraw on reopen, remove, block send mid-upload, report a failed upload, refuse over the cap, drag highlight counted, drop, paste files, text paste untouched, names, axe | ✅ E2E — the most thorough block in the unit |
| F58-F62 skills | `agents-skills.spec.ts:29,59,74,91,112,138,158,173,185` | staged name sent, always-on shown not sent, count in the accessible name, removal, sticky across turns, survives the CMS, reopened chips, no control when empty, axe | ✅ E2E |
| F61 stale staged name dropped | — | — | ❌ NONE |
| F63/F64 skills page | `skills-manage.spec.ts:25,44,72,93,109,130,158,176,194,208` | read-only code rows, create with derived identifier, edit, identifier not rewritten, delete, server refusal, missing field on submit, permission gating both ways, axe | ✅ E2E |
| F65/F66 context chip | 🧪 `routeContext.spec.ts` | URL → context; `new`/`trash` excluded | ❌ NONE rendered — nothing clicks **+ Add context**, so the opt-in that exists *because* auto-attaching was wrong is unasserted |
| F67 markdown | 🧪 `parseBlocks.spec.ts` | the parser, including pipe tables | ⚠️ PARTIAL — the **renderer** is untested: no case asserts the table markup, the link scheme allow-list, or that nothing reaches `dangerouslySetInnerHTML` |
| F68/F69/F70 errors | `agents-chat.spec.ts:162` (cancel); `agents-view.spec.ts:79,191` (list/thread failures) | the cancel line; failed list ≠ empty; a thread that will not open offers retry | ⚠️ PARTIAL — the destructive alert, the truncated-run **warning**, the 401 rewording and the minimized-only toast are all unasserted |
| F71 controller guard | — | — | ❌ NONE |
| F73 send while busy | — | — | ❌ NONE |
| **a11y** | `a11y.spec.ts:29,39,48,54,63,71,78`; `dock.spec.ts:308,316,325,333`; `agents-skills.spec.ts:185`; `agents-attachments.spec.ts:316`; `skills-manage.spec.ts:208` | axe (`wcag2a/2aa/21a/21aa`) over: empty thread + rail, a transcript with a step and a card, an expanded step, the archived list, the rename dialog, an open row menu, the open model picker, the empty dock, one window, three windows, a card in a window, staged skills, staged files, the skills list and form | ⚠️ PARTIAL — 14 scans, and every one of the five **Does Not Support** findings in §4A is outside what they can see: streaming (EC-44), heading rules (best-practice tag filter), the permission prompt (never rendered), the failed card (never rendered), table semantics inside model output (never generated by the mock) |

**Coverage tally: 75 features · 34 ✅ · 21 ⚠️ · 20 ❌**
**♿ tally: 15 findings — 8 Does Not Support · 7 Partially Supports · 0 Not Applicable.**
(Corrected on verification against each finding's own **Verdict:** line; the full
breakdown is in §6's accessibility tally.)

---

## 6. 🐞 Potential Bugs

### 🐞 BUG-copilot-admin-01 — the panel's history dropdown can put two windows on one conversation, and they immediately disagree · Severity: High

**Location:** `packages/copilot/admin/src/lib/presentation/CopilotPanel/index.tsx:509-514`
and `packages/copilot/admin/src/lib/application/sessions.ts:160-180`
**Category:** ux-state / data-integrity

**What the code does.** The sessions reducer guards against duplicates on the
`open` action:

```typescript
// Reopening a thread that is already open focuses it instead of
// showing the same conversation in two windows, which would give it
// two transcripts that immediately disagree.
const existing = action.conversationId
    ? state.find((s) => s.conversationId === action.conversationId)
    : undefined;
if (existing) { return capVisible(state.map(…), existing.id); }
```

The panel's `ConversationPicker` does not go through `open`. It calls
`chat.load(conversationId, loaded)` (`CopilotPanel/index.tsx:511-513`), which
dispatches a **chat** action, and the session learns the id afterwards through
`CopilotSession`'s `onDescribe` effect (`CopilotSession/index.tsx:56-63`) →
`{ type: 'meta' }` (`sessions.ts:210-223`), which has no such check.

**Why it is wrong:** the reducer's own comment states the invariant and the
reason for it. AGENTS.md:882-889 documents this as a known defect
("**One known gap, and it is a defect rather than missing coverage**"). Two
windows on one `conversationId` hold two independent `ChatState` entries in the
store keyed by *session* id, so a turn sent in one is invisible in the other —
and both will happily send turns into the same server-side thread, interleaving
them.

**Repro:**
1. Open two chat windows from the dock.
2. In window A, use the header's history dropdown to open thread T.
3. In window B, do the same.
4. Send "one" in A and "two" in B.
→ Observed: A shows only "one", B only "two"; reloading the thread shows both,
in whatever order the server assigned positions. A permission prompt raised by
either run appears in only one window.
/ Expected: step 3 focuses window A.

**Blast radius:** anyone using the docked panel's history. The transcripts are
recoverable (the server is the truth), but the *live* view is wrong, and a
permission prompt shown in a window the user is not looking at is a consent gate
that goes unanswered until it times out.

**Suggested fix:** route the picker through a session-level "open this thread"
that dispatches `{ type: 'open', conversationId }`, and have `load` remain what
the *page* uses once the session has already been resolved.

---

### 🐞 BUG-copilot-admin-02 — minimizing a window (including with Escape) drops keyboard focus on `<body>` · Severity: High · ♿

**Location:** `packages/copilot/admin/src/lib/presentation/CopilotSession/index.tsx:102-121`
(the call site) and `packages/copilot/admin/src/lib/presentation/CopilotPanel/index.tsx:246-253`
(the effect)
**Category:** a11y / ux-state

**What the code does.** `CopilotPanel` restores focus when it closes:

```typescript
setVisible(false);
const timer = setTimeout(() => {
    setRendered(false);
    returnFocusRef?.current?.focus();
}, MOTION_MS);
```

`returnFocusRef` is an **optional** prop (`:165-166`). `CopilotSession` renders
`<CopilotPanel … />` with fourteen props and **does not pass it**
(`CopilotSession/index.tsx:103-121`). `CopilotLauncher` builds a
`returnFocusRef` (`:85-86`) and never hands it down; it only calls
`newChatRef.current?.focus()` inline on **close** (`:128-131`).

So: **Close** restores focus (via the launcher's inline call). **Minimize** —
the Minus button, clicking the pill, the window cap collapsing the oldest, and
crucially **Escape**, which `CopilotPanel/index.tsx:219-228` and
`packages/copilot/admin/AGENTS.md:129-130` make the primary dismissal — sets
`open=false`, runs the same effect, and calls `.focus()` on `undefined?.current`,
which is a no-op. Focus is on an element that has just unmounted, so the browser
moves it to `<body>`.

**Why it is wrong:** the package's own contract says otherwise — CopilotPanel's
JSDoc (`:186-188`): "Focus is still *managed*: the composer takes focus on open,
and closing returns focus to whatever opened it rather than dropping it on
`<body>`", and AGENTS.md:127-128 repeats it. The `accessibility` skill requires
focus to be moved to a sensible place after an async/overlay action. Note also
the stale doc at `CopilotPanel/index.tsx:188` — "Escape closes it" — which
contradicts `:219-221` in the same file.

**Repro:**
1. Press ⌘J. Focus is in the composer.
2. Press **Escape**.
3. Press **Tab**.
→ Observed: focus lands on the first focusable element of the *page* (the skip
target / sidebar), not on the dock. `document.activeElement` is `<body>` between
steps 2 and 3.
/ Expected: focus on the dock's New chat button, per the documented behaviour.

Variant: open four chats; the cap minimizes the oldest. If that window had focus,
the same thing happens.

**Blast radius:** every keyboard-only and screen-reader user of the docked panel,
on the most common dismissal gesture. A sighted mouse user never notices.

**Suggested fix:** pass `returnFocusRef` from `CopilotSession` (threading it
through from `CopilotLauncher`), or move the focus call out of the effect and
into `onMinimize` alongside the existing `onClose` one.

---

### 🐞 BUG-copilot-admin-03 — the transcript scrolls to the bottom on every streamed token, overriding the reader · Severity: Medium · ♿

**Location:** `packages/copilot/admin/src/lib/presentation/MessageList/index.tsx:89-95`
**Category:** ux-state / a11y

**What the code does:**

```typescript
const endRef = useRef<HTMLDivElement>(null);

// Follow the answer as it streams. `block: 'end'` keeps the newest line in
// view without yanking the whole panel when a tool step expands.
useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
}, [turns]);
```

`turns` is a new array on every reducer commit, and a `text-delta` commits once
per token. There is no check for whether the user is already near the bottom.

**Why it is wrong:** the standard chat-transcript rule is "follow only if the
user has not scrolled away" — otherwise reading an earlier turn during a long
answer is impossible, because every token pulls the viewport back. The comment
anticipates one form of the problem ("without yanking the whole panel when a tool
step expands") and misses the more common one. It is also an unrequested change
of the reading position, adjacent to WCAG 3.2.2 in spirit, and it interacts badly
with a screen magnifier: the magnified viewport is dragged to the bottom several
times a second.

**Repro:**
1. Open a thread with ten turns.
2. Ask a question that produces a long answer against a **real** streaming
   provider (the mocked harness will not reproduce this — see EC-44).
3. While it streams, scroll up to read turn 3.
→ Observed: the view snaps back to the bottom within one token.
/ Expected: it stays where the user put it, ideally with a "jump to latest"
affordance.

**Blast radius:** everyone, on every long answer, but only against a streaming
provider — which is why it survives a suite that runs the fake.

**Suggested fix:** record whether the scroller is within ~100px of the bottom
before the update, and only call `scrollIntoView` when it was.

---

### 🐞 BUG-copilot-admin-04 — truncated-run reasons are hardcoded English inside a translated sentence · Severity: Medium

**Location:** `packages/copilot/admin/src/lib/presentation/MessageList/index.tsx:63-69`,
consumed at `:284-293`
**Category:** correctness / i18n

**What the code does:**

```typescript
const TRUNCATING_STOP_REASONS: Record<string, string> = {
    'max-steps': 'reached the maximum number of steps',
    'max-tokens': 'reached this run’s token budget',
    timeout: 'took too long',
    'max-output-tokens': 'hit the response length limit',
    refusal: 'declined to answer'
};
```

and

```tsx
{intl.formatMessage(messages.stoppedFor, { reason })}
```

where `stoppedFor` is `'Stopped because it {reason}.'`. The **frame** is
translated; the **clause** is not, and it is the half that carries the
information.

**Why it is wrong:** the root AGENTS.md's i18n convention and the
`accessibility` skill both require strings to go through `defineMessages` — "so
labels/errors are real, translatable text". Five user-facing sentences here are
not. A German admin sees *"Gestoppt, weil es reached the maximum number of
steps."* Worse, these are the exact five states that explain why an answer is
incomplete, so the person most in need of the sentence is the one who cannot
read it. Note the same five strings existed as `RUN_STOP_EXPLANATIONS` in
`copilot-domain` — also untranslated, which is where the pattern came from.
(ORT-109: that export claimed to be "for the UI to show" and could not be; it is
now module-private and model-facing, so the admin's own translated copy is the
only user-facing one. This finding is unaffected — those strings still need
`defineMessages`.)

**Repro:** switch the admin locale to a non-English one; force a `max-steps` run
(`COPILOT_MAX_STEPS=1`); read the warning alert.
→ Observed: a half-translated sentence. / Expected: fully localized.

**Blast radius:** every non-English deployment, on every truncated run.
**Suggested fix:** make each reason its own `defineMessages` entry and select on
`stopReason`.

---

### 🐞 BUG-copilot-admin-05 — the Stop message is a raw English literal · Severity: Low

**Location:** `packages/copilot/admin/src/lib/application/useCopilotChat.ts:388-391`
**Category:** correctness / i18n

```typescript
function describe(error: unknown, intl: IntlShape): Failure {
    if (error instanceof DOMException && error.name === 'AbortError') {
        return { message: 'Stopped.', systemic: false };
    }
```

Every other branch of `describe` uses `intl.formatMessage`
(`:396,407,411`), and the function already has `intl` in hand. This one string
is a literal.

It reaches the user in two ways: it is dispatched as the turn's `message` on a
`failed` action, and it is the toast description when a minimized panel's run
aborts. (The *ordinary* Stop path writes `messages.cancelled` instead
(`MessageList/index.tsx:48-51`), so this literal surfaces on the less common
route — an abort that is not the user's own Stop, e.g. a closed chat racing its
own frames.)

**Repro:** set the locale to `de`, minimize a window mid-run, close it from the
dock, and read the transcript/toast.
**Suggested fix:** add a `stopped` message beside the four already in the file.

---

### 🐞 BUG-copilot-admin-06 — sending while a run is in flight is silently swallowed · Severity: Low

**Location:** `packages/copilot/admin/src/lib/application/useCopilotChat.ts:167-170`
**Category:** ux-state

```typescript
const trimmed = text.trim();
if (!trimmed || runController(sessionId)) {
    return;
}
```

`Composer.submit` calls `onSend(text)` and then **clears the field
unconditionally** (`Composer/index.tsx:188-195`) — except it does not, because
`submit` itself is guarded by `blocked = busy || uploading` (`:186,190`), so
Enter is a no-op while busy and the text survives. That is the good case. The
guard in `useCopilotChat` is the second line of defence for any *other* caller —
`AgentsWelcome`'s openers (`AgentsThread/index.tsx:152-155`) call `send(text)`
directly with no `busy` check.

**Why it is worth reporting:** clicking an opener while a run is somehow already
in flight does nothing at all, with no message. More generally the hook's public
`send`/`sendWith` silently discard a turn, and the composer's own affordance
(the button becoming **Stop**) is the only feedback anywhere — which a
screen-reader user perceives only if they happen to re-read the button.

**Repro:** on the Agents welcome state, click two openers in quick succession.
→ Observed: the first sends, the second is discarded silently.
/ Expected: the openers disable while busy, or the second is queued.

**Suggested fix:** disable the openers on `chat.busy`, and have `sendWith`
return a boolean the caller can act on.

---

### 🐞 BUG-copilot-admin-07 — a viewer is offered attachment and skill controls their role cannot use · Severity: Low

**Location:** `packages/copilot/admin/src/lib/presentation/CopilotPanel/index.tsx:495,564`
and `AgentsThread/index.tsx:78,185`
**Category:** ux-state

Both surfaces always pass `attachments={files}` to the `Composer`, so the
paperclip always renders. Attaching runs `POST /api/media/assets` on the user's
own session, which requires `media:create` — a permission a **viewer** does not
hold. The upload therefore 403s and the chip shows a failure.

**Why it is wrong:** the package sets exactly the opposite rule for itself, one
prop away — "The composer renders no attach control at all when the surface
passes no `attachments` prop, rather than offering a button that fails"
(AGENTS.md:752-753), and the skills picker follows it
(`Composer/index.tsx:358`, "renders nothing when the workspace has no skills").
The mechanism to gate it exists (`useHasPermission`) and is already used twice in
this package.

**Repro:** sign in as a viewer, open a chat, click the paperclip, pick a file.
→ Observed: a chip appears and then fails with the server's 403.
/ Expected: no paperclip.

**Blast radius:** viewers only, cosmetic. Included because it is the one place
this package breaks a rule it wrote down.

**Suggested fix:** gate the `attachments` prop on
`useHasPermission(MEDIA_CREATE)`.

---

### 🐞 BUG-copilot-admin-08 — the keyboard hint says `⌘J` on every platform · Severity: Low

**Location:** `packages/copilot/admin/src/lib/presentation/CopilotDock/index.tsx:188`
**Category:** correctness

```tsx
<Kbd className="hidden sm:inline-flex">⌘J</Kbd>
```

The handler accepts either modifier (`CopilotLauncher/index.tsx:75`:
`if (!event.metaKey && !event.ctrlKey) return;`), but the hint is hard-coded to
the macOS glyph, is not translated, and is hidden below the `sm` breakpoint —
where it is the only place the shortcut is documented at all (AGENTS.md:118
makes the dock button "where the shortcut is now discoverable").

**Repro:** open the admin on Windows or Linux; the hint reads `⌘J`; pressing that
combination does nothing (there is no Command key).
**Suggested fix:** detect the platform (`navigator.platform` / `userAgentData`)
and render `Ctrl+J` otherwise.

---

### Checked and cleared

- **State sync between the two surfaces.** There is no divergence to find: a
  chat's `presented` field is `'dock'` or `'page'`, `dockSessions` filters on it
  (`sessions.ts:329-333`), and the page sets `'page'` — so the same chat is never
  rendered by both at once. Sending from one while the other is open is not a
  reachable state. The store (`copilotStore.ts:44`) is the single source, read
  through `useSyncExternalStore`, so if it ever *were* reachable it would sync
  correctly.
- **Double-send from two surfaces.** Same reason, plus `runController(sessionId)`
  is a per-chat singleton (`copilotStore.ts:211-218`).
- **Several docked windows behind the dock.** The cap minimizes rather than
  refuses (`sessions.ts:297-314`), the victim is deterministic (oldest, never the
  one just opened), and geometry is keyed by **slot** through a ref so a window
  changing slot cannot overwrite another's key.
- **The CMS ⇄ Agents switch returning to the page you left.** Correct, including
  the query string (`ViewSwitcher/index.tsx:97`), per workspace
  (`:39`), and resilient to `sessionStorage` throwing (`:51-66`).
- **Approving a permission twice.** The three buttons disable on
  `request.deciding` (`PermissionPrompt/index.tsx:70,114,122,130`) and the
  reducer clears any previous failure on `answering`
  (`chatReducer.spec.ts:404`). A second POST for a settled call gets a 404
  server-side.
- **Answering after the run ended.** `onError` keeps the buttons and shows "That
  answer did not reach the run" (`useCopilotChat.ts:315-321`,
  `PermissionPrompt/index.tsx:97-105`) — deliberate, documented, and unit-tested
  (`chatReducer.spec.ts:432`).
- **Tool-step disclosure.** `Collapsible` is Radix-backed, so `aria-expanded` and
  keyboard activation come for free; the payloads render as text in `<pre>`,
  never as markup.
- **Per-turn model picker.** Held on the session, sent per turn, seeded into the
  next chat, and it survives both a collapse and a trip through the CMS — the two
  regressions it was moved out of `useState` for are both covered by specs.
- **Navigate away mid-run.** The store is outside React and no hook aborts on
  unmount (`useCopilotChat.ts:152-156`); `agents-chat.spec.ts:140` proves it.
- **Markdown never uses `dangerouslySetInnerHTML`.** Verified by reading
  `Markdown/index.tsx` end to end — it builds React elements only.
- **Over-invalidation.** Only `conversationsScopeKey(workspaceId)` is
  invalidated after a turn (`useCopilotChat.ts:274-276`), not the whole cache —
  and `conversationsScopeKey` rather than `conversationsKey` is precisely the fix
  for the archived-link bug.
- **Error masquerading as empty.** The rail distinguishes the three states
  (`agents-view.spec.ts:79` asserts a failed list says so), and the thread offers
  a retry rather than a blank page.
- **`aria-hidden` on an open menu.** All three menus/popovers use
  `modal={false}` for exactly this reason and say so in comments.

---

**Defect tally:** `8 🐞 · 0 Critical · 2 High · 2 Medium · 4 Low · 0 🔒`
(BUG-02 and ♿-03 are cross-marked ♿/🔒 in their own headings.)

**Accessibility tally:** `15 ♿ · 0 Supports · 7 Partially Supports · 8 Does Not
Support · 0 Not Applicable` — corrected on verification: the pre-verification line
in §5 read `5 Does Not Support · 8 Partially Supports · 2 Not Applicable`, which
matched none of the fifteen findings' own **Verdict:** lines.

## 7. Recommended E2E Tests

All in `apps/admin-e2e` (Playwright POM + `page.route` mock layer), unless
marked 🧪. Ordered by value.

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | `apps/admin-e2e` POM + mock | `copilot/permission-prompt.spec.ts` (new); extend `support/api/copilot.ts` with a `tool-permission-request` frame and a `permission` route | The prompt renders with the tool's arguments; Allow once resumes; Allow for this chat stops it asking again; Don't allow produces a failed step; a 404 keeps the buttons and says so; a `tool-result` retires it; the buttons disable while in flight | F46, F47, F48, EC-33 — the **entire consent UI**, currently at ❌ NONE |
| 2 | `apps/admin-e2e` | `copilot/permission-prompt.spec.ts` — accessibility half | Focus moves to the prompt when it appears; it is announced outside the flooding log; an axe scan with the prompt open | ♿ A11Y-copilot-admin-03, ♿ -11 |
| 3 | `apps/admin-e2e` | `copilot/dock.spec.ts` (extend) | After **Escape**, `document.activeElement` is the dock's New chat button, not `<body>`; same after the window cap minimizes a focused window | 🐞 BUG-copilot-admin-02, ♿ -04, F18, EC-58 |
| 4 | `apps/admin-e2e` | `copilot/dock.spec.ts` (extend) | Opening the same thread from a second window's history dropdown **focuses** the first window instead of creating a duplicate | 🐞 BUG-copilot-admin-01, F19, EC-32 |
| 5 | `apps/admin-e2e` | `copilot/dock.spec.ts` (extend) — mock a failed apply | The card renders **Not saved** with the server's reason, the step draws as failed, and axe is clean on that state | F42, F44, and the `dock.spec.ts:333` gap that only ever draws an accepted card |
| 6 | 🧪 unit (`packages/copilot/admin`) | `presentation/Markdown/render.spec.tsx` (new, needs jsdom) | `<th scope="col">`, a table `aria-label`, a `javascript:` href stripped, `<script>` in a cell rendered as text | ♿ A11Y-copilot-admin-08, F67, EC-19, EC-20 |
| 7 | `apps/admin-e2e` | `copilot/a11y.spec.ts` (extend) + `support/fixtures.ts` | Add `best-practice` (or at least `heading-order` + `page-has-heading-one`) to the axe tags, and make `expectNoA11yViolations` fail on `incomplete` too | ♿ A11Y-copilot-admin-07, ♿ -10, and the harness gaps in §4A |
| 8 | `apps/admin-e2e` | `copilot/dock.spec.ts` (extend) | The `awaiting` marker: a parked run collapsed to the dock reads "— waiting for you", outranks "— finished", and counts toward the tab badge | F6, F49, F37 |
| 9 | `apps/admin-e2e` | `copilot/keyboard.spec.ts` (new) | Tab order through the dock with three chats; arrow keys inside the `role="toolbar"` (currently inert); Tab leaves the non-modal panel into the page; the NW resize corner resizes with arrows; the seven hidden strips are not tab stops | ♿ A11Y-copilot-admin-06, F11, F15 |
| 10 | `apps/admin-e2e` | `copilot/agents-view.spec.ts` (extend) at a 375px viewport | The rail becomes the **Chats** sheet, it traps focus, Escape closes it and returns focus to the trigger, picking a thread closes it; axe on the open sheet | F32, EC-15 |
| 11 | `apps/admin-e2e` | `copilot/agents-chat.spec.ts` (extend) | The truncated-run **warning** alert renders with the right reason; in a non-`en` locale the whole sentence is localized | 🐞 BUG-copilot-admin-04, F68 |
| 12 | `apps/admin-e2e` | `copilot/agents-chat.spec.ts` (extend) | A failed run shows a destructive alert **and keeps the partial text**; a 401 shows "Your session has expired"; a toast fires only while the window is minimized | F68, F69, F70 |
| 13 | 🧪 unit | `application/useCopilotChat.spec.ts` (new) | `describe()`'s four branches, including the abort literal; the `runController !== controller` bail-out on both the loop and the catch | 🐞 BUG-copilot-admin-05, F70, F71, EC-36 |
| 14 | `apps/admin-e2e` | `copilot/agents-view.spec.ts` (extend) | Clicking two welcome openers in quick succession sends once and gives feedback; sending while busy does not silently vanish | 🐞 BUG-copilot-admin-06, F73, EC-34 |
| 15 | `apps/admin-e2e` | `copilot/agents-chat.spec.ts` (extend) | **+ Add context** attaches a snapshot, the chip's `×` detaches, navigating re-offers the button, and `new`/`trash` never become an `entryId` | F65, F66 |
| 16 | `apps/admin-e2e` | `copilot/agents-view.spec.ts` (extend) as a **viewer** | No paperclip (once gated); the composer still works; no write-shaped affordance is offered | 🐞 BUG-copilot-admin-07, EC-25 |
| 17 | `apps/admin-e2e` | `copilot/agents-chat.spec.ts` (extend) | The composer shrinks again when text is deleted; an IME composition Enter does not send | F50, F51, EC-12 |
| 18 | Manual, scripted — **not** automatable in this harness | `docs/testing/` runbook | With a genuinely slow provider and a screen reader: token-by-token arrival, the live-region behaviour, and the auto-scroll override | ♿ A11Y-copilot-admin-01, 🐞 BUG-copilot-admin-03, F9/F41 (EC-44 makes these unreachable by `page.route`) |
| 19 | `apps/admin-e2e` | `copilot/dock.spec.ts` (extend) | Switching workspace with a chat open: the run keeps its original `X-Workspace-Id` and the remounted view shows the same transcript | EC-29 |
| 20 | 🧪 unit | `application/useComposerSkills.spec.ts` (new) | A staged name absent from the catalogue is dropped from `chosen` rather than sent | F61 |
