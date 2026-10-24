import { defineMessages, useIntl } from 'react-intl';
import { ChevronDown, History } from 'lucide-react';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger
} from '@orthacms/design-system';
import { useThreadActivity } from '../../application/useThreadActivity';
import { useConversations } from '../../application/useConversations';
import { useOpenConversation } from '../../application/useConversation';
import type { ChatMessage } from '../../domain/types/chat';

const messages = defineMessages({
    history: {
        id: 'copilot.history.label',
        defaultMessage: 'Previous chats'
    },
    // The button's name while another chat is parked on a question. It still
    // starts with the visible tooltip's words, and the dot is said, not only
    // drawn.
    historyAwaiting: {
        id: 'copilot.history.labelAwaiting',
        defaultMessage:
            'Previous chats — {count, plural, one {# chat} other {# chats}} waiting for you'
    },
    // Visually hidden after a row's title, the words for its dot.
    awaiting: {
        id: 'copilot.history.awaiting',
        defaultMessage: 'Waiting for you'
    },
    empty: {
        id: 'copilot.history.empty',
        defaultMessage: 'No previous chats'
    },
    untitled: {
        id: 'copilot.history.untitled',
        defaultMessage: 'Untitled chat'
    },
    failed: {
        id: 'copilot.history.failed',
        defaultMessage: 'Could not open that chat.'
    },
    // The trigger's name when it shows the window's title (R7): it starts
    // with that visible text, so "click Translate the pricing FAQ" works by
    // voice (2.5.3), and says what opening it does.
    titled: {
        id: 'copilot.history.titled',
        defaultMessage: '{title} — {history}'
    }
});

export interface ConversationPickerProps {
    /** The workspace whose threads are listed. */
    workspaceId: string;
    /**
     * The thread this window is on, if any. Left out of the "waiting for you"
     * marker: its prompt is already on screen in the transcript below.
     */
    currentConversationId?: string | null;
    /**
     * Called with the loaded transcript when a thread is picked.
     *
     * The **stored title** rides along: without it the window that adopts the
     * thread has no name until `CopilotSession` derives one from the first
     * message, so the pill and the header showed the opening question rather
     * than the thread's actual name — the rail's `openThread` has always passed
     * it, and this path is the one that did not.
     */
    onOpen(
        conversationId: string,
        title: string | null,
        messages: ChatMessage[]
    ): void;
    /**
     * The window's title, drawn **as the trigger** (R7, `AiWindow`): the
     * thread's name with a chevron, which opens the other threads. Omitted,
     * the trigger is the history icon.
     */
    title?: string;
}

/**
 * The thread history — reopen a persisted conversation.
 *
 * The list is a query (it is cached and invalidated as turns land) while
 * opening one is a mutation, because it targets a different thread each time
 * and its result is folded into the panel's reducer rather than rendered from
 * cache.
 *
 * **The button carries an amber dot while another thread is waiting for you**
 * — parked on a permission prompt, the same marker as "Ask Ortha AI" and the
 * Agents switch — and the row of that thread carries it too. It reads the
 * tab's live runs (`useThreadActivity`), so it says nothing about another
 * tab's, and it leaves out this window's own thread, whose prompt is already
 * in front of you.
 */
export function ConversationPicker({
    workspaceId,
    currentConversationId = null,
    onOpen,
    title
}: ConversationPickerProps) {
    const intl = useIntl();
    const { data: conversations } = useConversations(workspaceId);
    const open = useOpenConversation();
    const activity = useThreadActivity();
    let awaiting = 0;
    for (const [id, state] of activity) {
        if (state === 'awaiting' && id !== currentConversationId) awaiting++;
    }
    const label =
        awaiting > 0
            ? intl.formatMessage(messages.historyAwaiting, { count: awaiting })
            : intl.formatMessage(messages.history);

    return (
        // `modal={false}`: the panel this sits in is non-modal by design, and a
        // modal menu `aria-hidden`s the page root — focusable content included,
        // which axe fails as `aria-hidden-focus`.
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                {title !== undefined ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="relative h-7 min-w-0 gap-1 px-2 text-[13px] font-medium"
                        aria-label={intl.formatMessage(messages.titled, {
                            title,
                            history: label
                        })}
                    >
                        <span className="min-w-0 truncate">{title}</span>
                        <ChevronDown
                            aria-hidden
                            className="text-muted-foreground size-3.5 shrink-0"
                        />
                        {awaiting > 0 && (
                            <span
                                aria-hidden
                                data-marker="awaiting"
                                className="bg-warning size-2 shrink-0 rounded-full"
                            />
                        )}
                    </Button>
                ) : (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="relative size-8"
                        aria-label={label}
                        title={intl.formatMessage(messages.history)}
                    >
                        <History className="size-4" />
                        {awaiting > 0 && (
                            <span
                                aria-hidden
                                data-marker="awaiting"
                                className="bg-warning ring-background absolute top-1 right-1 size-2 rounded-full ring-2"
                            />
                        )}
                    </Button>
                )}
            </DropdownMenuTrigger>

            <DropdownMenuContent
                align={title !== undefined ? 'start' : 'end'}
                className="w-64"
            >
                <DropdownMenuLabel>
                    {intl.formatMessage(messages.history)}
                </DropdownMenuLabel>

                {open.isError && (
                    <p className="text-destructive px-2 py-1.5 text-xs">
                        {intl.formatMessage(messages.failed)}
                    </p>
                )}

                {!conversations || conversations.length === 0 ? (
                    <p className="text-muted-foreground px-2 py-1.5 text-xs">
                        {intl.formatMessage(messages.empty)}
                    </p>
                ) : (
                    conversations.map((conversation) => {
                        const waiting =
                            conversation.id !== currentConversationId &&
                            activity.get(conversation.id) === 'awaiting';
                        return (
                            <DropdownMenuItem
                                key={conversation.id}
                                className="flex-col items-start gap-0.5"
                                onSelect={() => {
                                    open.mutate(conversation.id, {
                                        onSuccess: (detail) =>
                                            onOpen(
                                                conversation.id,
                                                conversation.title,
                                                detail.messages
                                            )
                                    });
                                }}
                            >
                                <span className="flex w-full items-center gap-2">
                                    <span className="min-w-0 flex-1 truncate text-sm">
                                        {conversation.title ??
                                            intl.formatMessage(
                                                messages.untitled
                                            )}
                                    </span>
                                    {waiting && (
                                        <>
                                            <span
                                                aria-hidden
                                                data-marker="awaiting"
                                                className="bg-warning size-1.5 shrink-0 rounded-full"
                                            />
                                            <span className="sr-only">
                                                {intl.formatMessage(
                                                    messages.awaiting
                                                )}
                                            </span>
                                        </>
                                    )}
                                </span>
                                <span className="text-muted-foreground text-[11px]">
                                    {intl.formatDate(conversation.updatedAt, {
                                        dateStyle: 'medium',
                                        timeStyle: 'short'
                                    })}
                                </span>
                            </DropdownMenuItem>
                        );
                    })
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
