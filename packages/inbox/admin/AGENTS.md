# @orthacms/inbox-admin

The in-app inbox as people meet it
([ADR-0023](../../../docs/adr/0023-notices-and-the-inbox.md)): the `/inbox`
page, the **Inbox** row in the global sidebar's Overview group with the unread
count, and a button in a workspace sidebar's header so somebody working inside
one workspace still hears about the others.

```
src/lib/
  domain/types.ts              the wire shapes restated, payload accessors, byDay
  infrastructure/
    inboxGateway.ts            the port over /api/inbox + its HTTP impl, the mapper
    inboxKeys.ts               keys — none carries a workspace id
  application/hooks.ts         summary (polled), pages, mark read, mark all
  presentation/
    inboxPlugin/               the factory
    pages/InboxPage/           /inbox — tabs in the URL, Today / Earlier
    components/
      InboxItemRow/            one item: tile, sentence (readItem), where, when, action
      InboxHeaderButton/       the workspace header's button (WORKSPACE_NAV_HEADER_ACTION_SLOT)
      InboxSkeleton/
    hooks/useInboxNavBadge/    the sidebar row's count (SIDEBAR_NAV_SLOT.useBadge)
```

Layered per [ADR-0003](../../../docs/adr/0003-tactical-ddd-inside-plugins.md).

## The rules worth not re-deriving

**One summary read for every count.** The sidebar badge, the header button
and the page's tab counts all read `useInboxSummary` (`['inbox','summary']`),
polled once a minute — what fills the inbox happens in other people's
sessions. Marking read invalidates `['inbox']` and nothing else: a read moves
no review and no finding.

**Opening an item marks it read.** The item's one action is a link; its click
marks the item read and navigates. Its accessible name carries the sentence
("Review: Margaret asked you to review “Team page”"), so a list of Review
links is not a list of identical links.

**The words live here.** The server stores `kind` and a typed payload;
`readItem` turns them into a sentence, a tile and an action, through
react-intl like every admin string. An unknown kind renders as a plain line
rather than vanishing — an older admin must not drop an item a newer server
wrote.

**Workspace names come from the reader's own list** (`useWorkspaces`), so an
item costs no request to name where it happened.

**A failed read is not an empty inbox**, and the page says which.

**Every tab has a panel.** Radix gives each trigger `aria-controls`; with one
panel for the open tab only, the others dangle and axe fails
`aria-valid-attr-value`. One `TabsContent` per tab, the list in the open one.
