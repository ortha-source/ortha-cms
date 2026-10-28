import { useMemo } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCheck, Inbox, Settings } from 'lucide-react';
import {
    Button,
    Container,
    ContainerHeader,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from '@orthacms/design-system';
import { PageActionsPortal, PageTopBar } from '@orthacms/shell-admin';
import { useWorkspaces } from '@orthacms/workspaces-admin';
import {
    useInboxPages,
    useInboxSummary,
    useMarkAllRead,
    useMarkRead
} from '../../../application/hooks';
import {
    INBOX_CATEGORIES,
    byDay,
    type InboxCategory,
    type InboxItem
} from '../../../domain/types';
import { InboxItemRow } from '../../components/InboxItemRow';
import { InboxSkeleton } from '../../components/InboxSkeleton';

const messages = defineMessages({
    title: { id: 'inbox.title', defaultMessage: 'Inbox' },
    subtitle: {
        id: 'inbox.subtitle',
        defaultMessage: 'What needs you, across every workspace you belong to.'
    },
    tabsLabel: { id: 'inbox.tabsLabel', defaultMessage: 'Which items to show' },
    all: { id: 'inbox.tab.all', defaultMessage: 'All' },
    reviews: { id: 'inbox.tab.reviews', defaultMessage: 'Reviews' },
    alarms: { id: 'inbox.tab.alarms', defaultMessage: 'Alarms' },
    updates: { id: 'inbox.tab.updates', defaultMessage: 'Updates' },
    unreadCount: {
        id: 'inbox.tab.unreadCount',
        defaultMessage: '{count, plural, one {# unread} other {# unread}}'
    },
    markAll: { id: 'inbox.markAll', defaultMessage: 'Mark all as read' },
    settings: {
        id: 'inbox.settingsLink',
        defaultMessage: 'Notification settings'
    },
    today: { id: 'inbox.today', defaultMessage: 'Today' },
    earlier: { id: 'inbox.earlier', defaultMessage: 'Earlier' },
    more: { id: 'inbox.more', defaultMessage: 'Show older' },
    empty: {
        id: 'inbox.empty',
        defaultMessage:
            'Nothing here yet. Review requests, alarms and news about your own requests land here.'
    },
    emptyTab: {
        id: 'inbox.emptyTab',
        defaultMessage: 'Nothing in this tab.'
    },
    failed: {
        id: 'inbox.failed',
        defaultMessage:
            'Your inbox could not be loaded, so this list may be incomplete. Reload the page to try again.'
    }
});

type Tab = 'all' | InboxCategory;

function tabOf(value: string | null): Tab {
    return INBOX_CATEGORIES.find((category) => category === value) ?? 'all';
}

/**
 * `/inbox` — everything the reader was told, across every workspace they
 * belong to (ADR-0023): review requests, alarms their alarms raised, and news
 * about their own requests. One list, newest first, split into Today and
 * Earlier; tabs narrow it and carry their unread counts in words.
 *
 * Opening an item marks it read; **Mark all as read** sits in the top bar. A
 * failed read says so — "nothing here" is a claim about the reader's work,
 * and making it when the truth is "we could not ask" tells them they are free
 * when they may not be.
 */
export function InboxPage() {
    const intl = useIntl();
    const [searchParams, setSearchParams] = useSearchParams();
    const tab = tabOf(searchParams.get('tab'));
    const category = tab === 'all' ? undefined : tab;
    const summary = useInboxSummary();
    const pages = useInboxPages({ category });
    const markRead = useMarkRead();
    const markAll = useMarkAllRead();
    const { data: workspaces = [] } = useWorkspaces();

    const names = useMemo(
        () =>
            new Map(
                workspaces.map((workspace) => [workspace.id, workspace.name])
            ),
        [workspaces]
    );
    const items = pages.data?.pages.flatMap((page) => page.items) ?? [];
    const { today, earlier } = byDay(items);
    const counts = summary.data?.byCategory;
    const unread = summary.data?.unread ?? 0;

    const open = (item: InboxItem) => {
        if (!item.read) markRead.mutate(item.id);
    };

    const tabLabel = (value: Tab) => {
        const label = intl.formatMessage(messages[value]);
        const count = value === 'all' ? summary.data?.unread : counts?.[value];
        return (
            <>
                {label}
                {count ? (
                    <span className="text-xs font-normal tabular-nums text-muted-foreground">
                        {count}
                        <span className="sr-only">
                            {' '}
                            {intl.formatMessage(messages.unreadCount, {
                                count
                            })}
                        </span>
                    </span>
                ) : null}
            </>
        );
    };

    const section = (heading: string, rows: InboxItem[]) =>
        rows.length ? (
            <section className="flex flex-col gap-2" aria-label={heading}>
                <h2 className="text-[13px] font-medium text-muted-foreground">
                    {heading}
                </h2>
                <ul className="divide-y rounded-xl border bg-card">
                    {rows.map((item) => (
                        <InboxItemRow
                            key={item.id}
                            item={item}
                            workspaceName={
                                item.workspaceId
                                    ? (names.get(item.workspaceId) ?? null)
                                    : null
                            }
                            onOpen={open}
                        />
                    ))}
                </ul>
            </section>
        ) : null;

    const list = pages.isPending ? (
        <InboxSkeleton />
    ) : pages.isError ? (
        <p role="alert" className="text-sm text-destructive">
            {intl.formatMessage(messages.failed)}
        </p>
    ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
            {intl.formatMessage(
                tab === 'all' ? messages.empty : messages.emptyTab
            )}
        </p>
    ) : (
        <>
            {section(intl.formatMessage(messages.today), today)}
            {section(intl.formatMessage(messages.earlier), earlier)}
            {pages.hasNextPage ? (
                <div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => pages.fetchNextPage()}
                        disabled={pages.isFetchingNextPage}
                    >
                        {intl.formatMessage(messages.more)}
                    </Button>
                </div>
            ) : null}
        </>
    );

    return (
        <>
            <PageTopBar
                icon={Inbox}
                crumbs={[
                    { key: 'inbox', label: intl.formatMessage(messages.title) }
                ]}
            />
            <PageActionsPortal>
                <Button asChild variant="outline" size="sm">
                    <Link to="/inbox/settings">
                        <Settings aria-hidden />
                        {intl.formatMessage(messages.settings)}
                    </Link>
                </Button>
                <Button
                    size="sm"
                    onClick={() => markAll.mutate(category)}
                    disabled={markAll.isPending || unread === 0}
                >
                    <CheckCheck aria-hidden />
                    {intl.formatMessage(messages.markAll)}
                </Button>
            </PageActionsPortal>
            <Container className="flex flex-col gap-6">
                <ContainerHeader
                    title={intl.formatMessage(messages.title)}
                    subtitle={intl.formatMessage(messages.subtitle)}
                />
                <Tabs
                    value={tab}
                    onValueChange={(next) =>
                        setSearchParams(
                            (params) => {
                                const updated = new URLSearchParams(params);
                                if (next === 'all') updated.delete('tab');
                                else updated.set('tab', next);
                                return updated;
                            },
                            { replace: true }
                        )
                    }
                >
                    <TabsList
                        aria-label={intl.formatMessage(messages.tabsLabel)}
                    >
                        <TabsTrigger value="all">{tabLabel('all')}</TabsTrigger>
                        {INBOX_CATEGORIES.map((value) => (
                            <TabsTrigger key={value} value={value}>
                                {tabLabel(value)}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    {(['all', ...INBOX_CATEGORIES] as const).map((value) => (
                        // One panel per tab, so every trigger's
                        // `aria-controls` names an element; only the open
                        // one holds the list.
                        <TabsContent
                            key={value}
                            value={value}
                            className="flex flex-col gap-6"
                        >
                            {value === tab ? list : null}
                        </TabsContent>
                    ))}
                </Tabs>
            </Container>
        </>
    );
}
