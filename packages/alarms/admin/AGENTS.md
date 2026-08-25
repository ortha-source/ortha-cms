# @orthacms/alarms-admin

The admin half of **content alarms** — the workspace's alarms page and rule
editor, plus the three Content Library slot contributions that put a finding
where it actually gets fixed.

Layout: **layered** (`domain` omitted — see below), per ADR-0003.

## The surface that matters is not the page

Nobody opens an alarms page to find out their article is broken. They open the
article. So the primary contribution here is the **entry rail's checks block**
(`ENTRY_SIDEBAR_WIDGET_SLOT`): an editor sees "Author is not published" beside
the record, with a link to the author, without knowing a rule exists.

The page is for the person who owns editorial policy — what is flagged across
the workspace, grouped by rule, and the rules themselves.

## How a rule gets made

Through **"Save as rule"** in the records toolbar (`RECORDS_TOOLBAR_SLOT`), not
through a blank form. The sequence a person actually goes through is:

1. Something looks wrong, so they filter the content list.
2. They see the fourteen records and confirm it with their eyes.
3. They ask the CMS to keep watching.

At step 3 the condition is already built and already verified. Asking them to
re-enter it in a rule editor would be asking them to check their own work; a
blank condition form invites writing a rule against a collection nobody has
looked at, which is how you get a rule that matches everything.

There is therefore **no "create rule" page**. `AlarmRuleEditorPage` edits an
existing rule — its wording, its level, its condition — with the records list's
own `QueryBuilderPanel` over `useFilterFields`, the same server-derived paths.

Two fields in the save dialog look redundant and are not:

- **Rule name** — how the rule is listed, in the language of editorial policy:
  "Relations point at published records".
- **What editors will see** — the finding's title, on the record itself:
  "Author is not published".

Collapsing them gives you either a rule list full of instructions or an editor
being told about "relations pointing at published records" while looking at the
piece they are writing.

## The one non-obvious call in the code

`AlarmRuleEditorPage` serialises with
`treeToJsonFilter(tree, new Date(), { relativeDates: true })`.

By default the query builder resolves a "within the last N days" rule into a
concrete cutoff, which is right for a URL — a shared link should keep showing
the same rows — and silently wrong for a **stored** filter, which would then
mean "since the day I was written" for ever while looking entirely normal in the
editor. This is the only place in the admin that stores a filter rather than
linking one, so it is the only place that asks for the relative spelling.

A consequence worth knowing: a rule saved from the records toolbar inherits the
URL's already-frozen cutoff, because the URL has no way to say which of the two
the person meant. Making it a rolling window is a one-line edit in the rule
editor.

## Layout

```
src/lib/
  utils/
    alarmsPlugin/            # the AdminPlugin factory — routes + five slots
    alarmsColumnMessages/    # the one descriptor the factory itself needs
  application/               # TanStack hooks over the gateway
    useAlarmRules, useAlarmFindings, useFindingsByEntry, useAlarmSummary
    useAlarmRuleMutations, useMuteFinding
  infrastructure/
    alarmsGateway/           # the port the presentation layer depends on
    httpAlarmsGateway/       # its impl — the only file importing apiClient
    alarmMapper/             # wire → view (the anti-corruption layer)
    alarmsKeys/              # query keys, all prefixed with the workspace id
  presentation/
    severityLook/            # severity → icon + classes (the one place)
    pages/AlarmsPage, pages/AlarmRuleEditorPage
    components/…             # SeverityBadge, FindingList, RuleList, the slots
      FindingsToolResult/    # the copilot's `admin_alarms_findings`, rendered
  types/alarm/               # the view models
```

**No `domain/` layer**, deliberately. ADR-0003 is explicit that a read-mostly
viewer gets a mapper and query hooks rather than client value objects it would
have nothing to validate. The one real invariant — a finding's state machine —
is enforced server-side and merely rendered here.

## The copilot's findings, rendered

`FindingsToolResult` is contributed to `COPILOT_TOOL_RESULT_SLOT` for
`admin_alarms_findings`, so a copilot answer about flagged content renders as
rows with links instead of a JSON blob. Most tool results are provenance — the
answer is the assistant's prose and the call is the receipt. This one is
different: a list of flagged records **is** the answer, and every row has
somewhere to go.

**The one thing on it that exists nowhere else in the product is how long each
finding has been open.** The alarms page shows a date; the entry rail shows
none. Neither answers the question a person actually has when handed a list of
problems — _which of these have been rotting?_ — and that question is what turns
a list into a priority. `FindingAgeBar` draws it scaled to the oldest finding in
the same result (`ageBarWidth`, 4% floor so a brand-new finding still reads as a
row rather than as an absence), with the number in text beside it: the number is
the data, the bar is only the comparison, so a screen reader, forced colors or a
printout loses the ranking-at-a-glance and nothing else.

The bar is a single neutral colour deliberately. Length already carries
magnitude, and colouring it by severity would put two encodings on one mark
while leaning on exactly the red/amber pair a colourblind reader cannot
separate. Severity is the glyph at the start of the row instead.

- **`readToolFindings` returns `null` rather than throwing.** A transcript is
  replayed from stored history, so a result written by an older build of the tool
  reaches today's renderer. Every malformed shape falls through to the raw
  payload `ToolStep` renders anyway — a JSON blob is a far better outcome than a
  crashed conversation. A row whose severity this build does not know is dropped
  rather than rendered under the wrong one; the header's count comes from
  `bySeverity`, so the total stays honest either way.
- **The header describes the whole set, not the page.** `total` and `bySeverity`
  are the tool's, and the "N more not shown" line is the difference — a strip
  saying "1 warning" over a workspace with fourteen is worse than no strip.

## Severity has a shape, not only a colour

`severityLook` is the one place a severity becomes a look, and it hands back an
**icon** as well as classes: `CircleAlert` for error, `TriangleAlert` for warn,
`Info` for info. The colours are the design system's reserved status tokens
(`destructive` / `warning` / `info`), not raw palette steps — and the icons are
not decoration. Converting those tokens to hex and running the dataviz skill's
palette validator puts error against warn at **ΔE 0.9 under deuteranopia and
14.8 with normal vision**, below the 15 floor: the two loudest severities are
the pair a reader cannot tell apart by hue. Shape carries the distinction, the
label carries it in words, and the colour is the redundant third.

Anything new that renders a severity goes through `severityLook`. A hue picked
locally is a hue nobody measured.

## Details worth keeping

- **Query keys carry the workspace id.** Scoping is server-side via the
  `X-Workspace-Id` header the shared `apiClient` attaches, so without the id in
  the key, switching workspaces would serve the previous one's findings out of
  cache.
- **The records column honours `isVisible`.** Extension columns are hidden by
  default and `useRowsData` runs on every render regardless, so ignoring it
  would fetch on every page of every list for data nobody is looking at.
- **`isError` is never the empty state.** "Nothing is flagged" and "we could not
  check" render identically if you let the error fall through, and only one of
  them is reassuring. The findings list, the rule list, the entry widget and the
  records cell each give the failure its own words.
- **The findings page clamps `page` to `pageCount`.** Muting the last row of a
  trailing page leaves the pager hidden and the user stranded on an empty page.
- **Mutations invalidate the workspace's alarms root.** A mute moves a finding
  between tabs, changes two counts on its rule and the summary badge; a rule
  edit triggers a server-side rescan. There is no narrower placement worth the
  bookkeeping.
- **Severity is a word as well as a colour.** Encoding the whole meaning of a
  finding in hue fails WCAG 1.4.1 and fails anyone who cannot tell the three
  apart.

## Commands

- `npx nx run-many -t typecheck -p @orthacms/alarms-admin`
- `npx nx test @orthacms/alarms-admin` — `toolOutput` is unit-tested
  (`testEnvironment: 'node'`, as in copilot-admin: the tested code is pure)
- `npx eslint packages/alarms/admin`
