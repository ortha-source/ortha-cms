import { useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { defineMessages, useIntl, type MessageDescriptor } from 'react-intl';
import { Archive, ArrowLeft, BookOpen, Plus, Search } from 'lucide-react';
import { Button, Skeleton, cn, toast } from '@orthacms/design-system';
import { useHasPermission } from '@orthacms/identity-admin';
import { useAgentNavigation } from '../../application/useAgentThread';
import {
    useConversations,
    type CopilotConversation
} from '../../application/useConversations';
import { useUpdateConversation } from '../../application/useUpdateConversation';
import { useThreadActivity } from '../../application/useThreadActivity';
import {
    filterConversations,
    groupConversations,
    type ConversationGroupId
} from '../../application/groupConversations';
import {
    COPILOT_SKILLS_MANAGE,
    SKILLS_SEGMENT,
    agentSkillsPath,
    readAgentThreadId
} from '../../domain/agentsRoute';
import {
    NEW_CHAT_KEY_SHORTCUTS,
    shortcutModifierGlyph
} from '../../domain/shortcut';
import { AgentsChatRow } from './AgentsChatRow';
import { RenameChatDialog } from './RenameChatDialog';

const messages = defineMessages({
    heading: {
        id: 'copilot.agents.rail.list',
        defaultMessage: 'Chats'
    },
    newChat: {
        id: 'copilot.agents.rail.newChat',
        defaultMessage: 'New chat'
    },
    skills: {
        id: 'copilot.agents.rail.skills',
        defaultMessage: 'Skills'
    },
    tools: {
        id: 'copilot.agents.rail.tools',
        defaultMessage: 'Tools'
    },
    search: {
        id: 'copilot.agents.rail.search',
        defaultMessage: 'Search chats'
    },
    empty: {
        id: 'copilot.agents.rail.empty',
        defaultMessage: 'No chats yet. Ask something to start one.'
    },
    emptyArchived: {
        id: 'copilot.agents.rail.emptyArchived',
        defaultMessage: 'Nothing archived.'
    },
    showArchived: {
        id: 'copilot.agents.rail.showArchived',
        defaultMessage: 'Archived'
    },
    backToChats: {
        id: 'copilot.agents.rail.backToChats',
        defaultMessage: 'Back to chats'
    },
    archivedList: {
        id: 'copilot.agents.rail.archivedList',
        defaultMessage: 'Archived chats'
    },
    archived: {
        id: 'copilot.agents.rail.archivedToast',
        defaultMessage: 'Chat archived.'
    },
    unarchived: {
        id: 'copilot.agents.rail.unarchivedToast',
        defaultMessage: 'Chat restored.'
    },
    renamed: {
        id: 'copilot.agents.rail.renamedToast',
        defaultMessage: 'Chat renamed.'
    },
    updateFailed: {
        id: 'copilot.agents.rail.updateFailed',
        defaultMessage: 'Could not update the chat. Please try again.'
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

/**
 * The sidebar's group label — the same quiet line the content tree's
 * "Workspace content" and the workspace's "Tools" use, so the Agents view
 * reads as the same sidebar in another mode rather than a second navigation.
 */
const LABEL =
    'flex h-8 items-center px-2 text-xs font-medium text-sidebar-foreground/70';

/** A row: the sidebar's own height, padding, hover and focus ring. */
const ROW =
    'flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-sidebar-ring';

export interface AgentsSidebarProps {
    /** The workspace whose threads are listed. */
    workspaceId: string;
}

/**
 * **The chats, in the sidebar** — what the workspace sidebar shows while the
 * Agents view is open, in place of the content tree (R7: "Agents mode swaps
 * the content tree for your chats, grouped by day").
 *
 * It used to be a third column beside the sidebar: a resizable rail with its
 * own New chat and filter, plus a sheet on mobile. That spent 18rem of the page
 * on a list the sidebar had room for, and put two navigations side by side.
 * Now the `ViewSwitcher`'s section claims the sidebar on every Agents path
 * (`WorkspaceSectionItem.takeover`), so the CMS navigation is one click away on
 * the switcher above and comes back the moment you switch — and on a phone the
 * list is wherever the sidebar is.
 *
 * **It navigates; it holds no chat state.** Which thread is open is a fact
 * about the URL (`useAgentThread` binds it to a transcript).
 *
 * - **A row is its name**, plus a spinner while its answer streams and an
 *   amber dot while it waits on you — both said in words in the row's name.
 * - **The filter appears past five chats**: a search box over three rows is
 *   furniture that pushes the rows it searches down the column.
 * - **Tools** holds the two doors that are not chats: Skills, for whoever may
 *   author them, and Archived, once something is archived — a permanent
 *   "Archived (0)" is a door to an empty room. Archived is a *mode* of this
 *   list rather than a route, so Back keeps moving between threads.
 */
export function AgentsSidebar({ workspaceId }: AgentsSidebarProps) {
    const intl = useIntl();
    const { pathname } = useLocation();
    const { startNew, select } = useAgentNavigation(workspaceId);
    const activity = useThreadActivity();
    const canManageSkills = useHasPermission(COPILOT_SKILLS_MANAGE);
    const [query, setQuery] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const [renaming, setRenaming] = useState<CopilotConversation | null>(null);
    /**
     * How to give the renamed row's menu button focus back. A **ref, not
     * state**: closing the dialog clears `renaming` in the same commit that
     * unmounts it, so a callback held in state is already gone by the time
     * Radix fires `onCloseAutoFocus`.
     */
    const returnFocusRef = useRef<(() => void) | null>(null);
    const {
        data: conversations,
        isPending,
        isError,
        refetch
    } = useConversations(workspaceId, showArchived);
    // Its own query, so the Archived row can hide itself while nothing is
    // archived. One cached request per workspace.
    const { data: archived } = useConversations(workspaceId, true);
    const update = useUpdateConversation(workspaceId);

    const activeId = readAgentThreadId(pathname);
    const onSkills = pathname.split('/').filter(Boolean)[3] === SKILLS_SEGMENT;
    const hasArchived = (archived?.length ?? 0) > 0;
    const shortcut = `${shortcutModifierGlyph()}J`;

    /** Files a thread away, or brings it back — with a line saying which. */
    const toggleArchived = (conversation: CopilotConversation) =>
        update.mutate(
            {
                conversationId: conversation.id,
                patch: { archived: !conversation.archived }
            },
            {
                onSuccess: () => {
                    toast.success(
                        intl.formatMessage(
                            conversation.archived
                                ? messages.unarchived
                                : messages.archived
                        )
                    );
                    // Archiving what you are reading leaves you on a thread
                    // that is in no visible list. Start a new chat instead —
                    // the thread is filed, not lost.
                    if (conversation.id === activeId) {
                        startNew();
                    }
                },
                onError: () =>
                    toast.error(intl.formatMessage(messages.updateFailed))
            }
        );

    const groups = useMemo(
        () =>
            groupConversations(
                filterConversations(conversations ?? [], query),
                new Date()
            ),
        [conversations, query]
    );

    const leaveArchive = () => {
        setShowArchived(false);
        setQuery('');
    };

    return (
        <nav
            aria-label={intl.formatMessage(messages.heading)}
            className="flex w-full min-w-0 flex-col gap-2 pb-2"
        >
            <div className="flex flex-col gap-1 px-2">
                <div className={cn(LABEL, 'justify-between')}>
                    <h2>
                        {intl.formatMessage(
                            showArchived
                                ? messages.archivedList
                                : messages.heading
                        )}
                    </h2>
                    {/* The chord is New chat's `aria-keyshortcuts`; the glyph
                        is decorative and follows the platform. */}
                    {showArchived ? null : (
                        <kbd
                            aria-hidden
                            className="border-sidebar-border bg-background/60 text-muted-foreground inline-flex h-[18px] items-center rounded border px-[5px] font-sans text-[11px] font-medium"
                        >
                            {shortcut}
                        </kbd>
                    )}
                </div>
                {/* One control, two jobs — because they are the same job: "get
                    me out of here and back to chatting". */}
                {showArchived ? (
                    <button
                        type="button"
                        className={ROW}
                        onClick={leaveArchive}
                    >
                        <ArrowLeft aria-hidden className="size-4 shrink-0" />
                        {intl.formatMessage(messages.backToChats)}
                    </button>
                ) : (
                    <button
                        type="button"
                        className={ROW}
                        onClick={startNew}
                        aria-keyshortcuts={NEW_CHAT_KEY_SHORTCUTS}
                    >
                        <Plus aria-hidden className="size-4 shrink-0" />
                        {intl.formatMessage(messages.newChat)}
                    </button>
                )}

                {(conversations?.length ?? 0) > 5 && (
                    <div className="relative mt-1">
                        <Search
                            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
                            aria-hidden
                        />
                        <input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={intl.formatMessage(messages.search)}
                            aria-label={intl.formatMessage(messages.search)}
                            className="border-sidebar-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-sidebar-ring h-8 w-full rounded-lg border pr-2 pl-8 text-[13px] shadow-xs outline-none focus-visible:ring-2"
                        />
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-1 px-2">
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
                        className="text-sidebar-foreground space-y-2 px-2 py-1 text-xs"
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
                    <p className="text-sidebar-foreground px-2 py-1 text-xs">
                        {query.trim()
                            ? intl.formatMessage(messages.noMatches, {
                                  query: query.trim()
                              })
                            : intl.formatMessage(
                                  showArchived
                                      ? messages.emptyArchived
                                      : messages.empty
                              )}
                    </p>
                )}

                {groups.map((group) => (
                    <section key={group.id}>
                        <h3 className={LABEL}>
                            {intl.formatMessage(GROUP_LABELS[group.id])}
                        </h3>
                        <ul className="flex flex-col gap-0.5">
                            {group.conversations.map((conversation) => (
                                <AgentsChatRow
                                    key={conversation.id}
                                    conversation={conversation}
                                    active={conversation.id === activeId}
                                    activity={activity.get(conversation.id)}
                                    onSelect={() => select(conversation.id)}
                                    onRename={(returnFocus) => {
                                        returnFocusRef.current = returnFocus;
                                        setRenaming(conversation);
                                    }}
                                    onToggleArchived={() =>
                                        toggleArchived(conversation)
                                    }
                                />
                            ))}
                        </ul>
                    </section>
                ))}
            </div>

            {/* The two doors that are not chats. Skills only for whoever may
                author one (fail-closed); Archived only once something has been
                filed, and not while you are already in it. */}
            {canManageSkills || (!showArchived && hasArchived) ? (
                <div className="flex flex-col gap-0.5 px-2">
                    <h2 className={LABEL}>
                        {intl.formatMessage(messages.tools)}
                    </h2>
                    {canManageSkills ? (
                        <Link
                            to={agentSkillsPath(workspaceId)}
                            {...(onSkills
                                ? { 'aria-current': 'page' as const }
                                : {})}
                            className={cn(
                                ROW,
                                onSkills &&
                                    'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                            )}
                        >
                            <BookOpen aria-hidden className="size-4 shrink-0" />
                            {intl.formatMessage(messages.skills)}
                        </Link>
                    ) : null}
                    {!showArchived && hasArchived ? (
                        <button
                            type="button"
                            className={ROW}
                            onClick={() => {
                                setShowArchived(true);
                                setQuery('');
                            }}
                        >
                            <Archive aria-hidden className="size-4 shrink-0" />
                            {intl.formatMessage(messages.showArchived)}
                            <span className="text-sidebar-foreground ml-auto text-xs tabular-nums">
                                {archived?.length}
                            </span>
                        </button>
                    ) : null}
                </div>
            ) : null}

            <RenameChatDialog
                conversation={renaming}
                saving={update.isPending}
                failed={update.isError}
                onClose={() => setRenaming(null)}
                onReturnFocus={() => returnFocusRef.current?.()}
                onSave={(title) => {
                    if (!renaming) return;
                    update.mutate(
                        { conversationId: renaming.id, patch: { title } },
                        {
                            onSuccess: () => {
                                setRenaming(null);
                                toast.success(
                                    intl.formatMessage(messages.renamed)
                                );
                            }
                            // No `onError`: the dialog stays open and says so
                            // itself, which is where the user's typing is.
                        }
                    );
                }}
            />
        </nav>
    );
}
