import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { defineMessages, useIntl, type MessageDescriptor } from 'react-intl';
import { MessageSquarePlus, Search } from 'lucide-react';
import { Button, Input, Skeleton } from '@ortha-cms/design-system';
import { useAgentNavigation } from '../../../application/useAgentThread';
import { useConversations } from '../../../application/useConversations';
import {
    filterConversations,
    groupConversations,
    type ConversationGroupId
} from '../../../application/groupConversations';
import { readAgentThreadId } from '../../../domain/agentsRoute';
import { AgentsRailRow } from './AgentsRailRow';

const messages = defineMessages({
    newChat: {
        id: 'copilot.agents.rail.newChat',
        defaultMessage: 'New chat'
    },
    search: {
        id: 'copilot.agents.rail.search',
        defaultMessage: 'Search chats'
    },
    list: {
        id: 'copilot.agents.rail.list',
        defaultMessage: 'Chats'
    },
    empty: {
        id: 'copilot.agents.rail.empty',
        defaultMessage: 'No chats yet. Ask something to start one.'
    },
    noMatches: {
        id: 'copilot.agents.rail.noMatches',
        defaultMessage: 'No chats match “{query}”.'
    },
    failed: {
        id: 'copilot.agents.rail.failed',
        defaultMessage: 'Could not load your chats.'
    },
    retry: {
        id: 'copilot.agents.rail.retry',
        defaultMessage: 'Try again'
    },
    today: {
        id: 'copilot.agents.rail.group.today',
        defaultMessage: 'Today'
    },
    yesterday: {
        id: 'copilot.agents.rail.group.yesterday',
        defaultMessage: 'Yesterday'
    },
    week: {
        id: 'copilot.agents.rail.group.week',
        defaultMessage: 'Previous 7 days'
    },
    month: {
        id: 'copilot.agents.rail.group.month',
        defaultMessage: 'Previous 30 days'
    },
    older: {
        id: 'copilot.agents.rail.group.older',
        defaultMessage: 'Older'
    }
});

/** The heading each recency bucket renders under. */
const GROUP_LABELS: Record<ConversationGroupId, MessageDescriptor> = {
    today: messages.today,
    yesterday: messages.yesterday,
    week: messages.week,
    month: messages.month,
    older: messages.older
};

/** Buckets whose heading already states the day, so rows show a clock time. */
const SAME_DAY_GROUPS = new Set<ConversationGroupId>(['today', 'yesterday']);

export interface AgentsRailListProps {
    /** The workspace whose threads are listed. */
    workspaceId: string;
    /**
     * Called after the user picks a thread or starts a new one. The desktop
     * rail ignores it; the mobile sheet uses it to close itself, since the list
     * it was opened from is now behind the answer it navigated to.
     */
    onNavigate?(): void;
}

/**
 * The thread list — New chat, a filter, and every conversation grouped by when
 * it was last used.
 *
 * **It navigates; it holds no chat state.** Which thread is open is a fact about
 * the URL (`useAgentThread` is what binds that to a transcript), so this list
 * needs nothing from the page it sits beside — which is exactly what lets the
 * same component serve both the desktop rail and the mobile sheet.
 */
export function AgentsRailList({
    workspaceId,
    onNavigate
}: AgentsRailListProps) {
    const intl = useIntl();
    const { pathname } = useLocation();
    const { startNew, select } = useAgentNavigation(workspaceId);
    const [query, setQuery] = useState('');
    const {
        data: conversations,
        isPending,
        isError,
        refetch
    } = useConversations(workspaceId);

    const activeId = readAgentThreadId(pathname);

    const groups = useMemo(
        () =>
            groupConversations(
                filterConversations(conversations ?? [], query),
                new Date()
            ),
        [conversations, query]
    );

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-col gap-2 p-2">
                <Button
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => {
                        startNew();
                        onNavigate?.();
                    }}
                >
                    <MessageSquarePlus className="size-4" />
                    {intl.formatMessage(messages.newChat)}
                </Button>

                {/* The filter appears once there is enough history for it to be
                    worth typing into. A search box over three rows is furniture
                    that pushes the rows it searches further down the rail. */}
                {(conversations?.length ?? 0) > 5 && (
                    <div className="relative">
                        <Search
                            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2"
                            aria-hidden
                        />
                        <Input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={intl.formatMessage(messages.search)}
                            aria-label={intl.formatMessage(messages.search)}
                            className="h-8 pl-7 text-sm"
                        />
                    </div>
                )}
            </div>

            <nav
                aria-label={intl.formatMessage(messages.list)}
                className="min-h-0 flex-1 overflow-y-auto px-2 pb-3"
            >
                {isPending && (
                    <div className="space-y-2 px-2 py-1" aria-hidden>
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-4 w-4/5" />
                        <Skeleton className="h-4 w-1/2" />
                    </div>
                )}

                {/* A failed list is not an empty list. Saying "no chats yet"
                    when the request 500'd would tell the user their history is
                    gone. */}
                {isError && (
                    <div
                        role="alert"
                        className="text-muted-foreground space-y-2 px-2 py-1 text-xs"
                    >
                        <p>{intl.formatMessage(messages.failed)}</p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void refetch()}
                        >
                            {intl.formatMessage(messages.retry)}
                        </Button>
                    </div>
                )}

                {!isPending && !isError && groups.length === 0 && (
                    <p className="text-muted-foreground px-2 py-1 text-xs">
                        {query.trim()
                            ? intl.formatMessage(messages.noMatches, {
                                  query: query.trim()
                              })
                            : intl.formatMessage(messages.empty)}
                    </p>
                )}

                {groups.map((group) => (
                    <section key={group.id} className="mb-3">
                        <h3 className="text-muted-foreground px-2 pb-1 text-[11px] font-medium tracking-wide uppercase">
                            {intl.formatMessage(GROUP_LABELS[group.id])}
                        </h3>
                        <ul className="space-y-0.5">
                            {group.conversations.map((conversation) => (
                                <AgentsRailRow
                                    key={conversation.id}
                                    conversation={conversation}
                                    active={conversation.id === activeId}
                                    timeOnly={SAME_DAY_GROUPS.has(group.id)}
                                    onSelect={() => {
                                        select(conversation.id);
                                        onNavigate?.();
                                    }}
                                />
                            ))}
                        </ul>
                    </section>
                ))}
            </nav>
        </div>
    );
}
