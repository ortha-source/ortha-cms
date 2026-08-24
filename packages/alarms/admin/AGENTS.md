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
    alarmsPlugin/            # the AdminPlugin factory — routes + four slots
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
    pages/AlarmsPage, pages/AlarmRuleEditorPage
    components/…             # SeverityBadge, FindingList, RuleList, the slots
  types/alarm/               # the view models
```

**No `domain/` layer**, deliberately. ADR-0003 is explicit that a read-mostly
viewer gets a mapper and query hooks rather than client value objects it would
have nothing to validate. The one real invariant — a finding's state machine —
is enforced server-side and merely rendered here.

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
- `npx eslint packages/alarms/admin`
