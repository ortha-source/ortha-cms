import { useRef } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ArchiveRestore, Archive, MoreHorizontal, Pencil } from 'lucide-react';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    cn
} from '@ortha-cms/design-system';
import type { CopilotConversation } from '../../../../application/useConversations';

const messages = defineMessages({
    // The rail's own word for a thread with no server-derived title yet.
    // Deliberately not "New chat": that is the name of the button above the
    // list, and two controls in one region answering to the same name is
    // ambiguous by voice and in a screen reader's control list.
    untitled: {
        id: 'copilot.agents.rail.untitled',
        defaultMessage: 'Untitled chat'
    },
    // Named after the chat it acts on, so a screen reader's control list is a
    // list of distinct actions rather than a column of identical "More" buttons.
    actions: {
        id: 'copilot.agents.rail.actions',
        defaultMessage: 'Actions for {title}'
    },
    rename: {
        id: 'copilot.agents.rail.rename',
        defaultMessage: 'Rename…'
    },
    archive: {
        id: 'copilot.agents.rail.archive',
        defaultMessage: 'Archive'
    },
    unarchive: {
        id: 'copilot.agents.rail.unarchive',
        defaultMessage: 'Unarchive'
    }
});

export interface AgentsRailRowProps {
    /** The thread this row opens. */
    conversation: CopilotConversation;
    /** Whether it is the thread on screen. */
    active: boolean;
    /**
     * True when the group heading above already states the day, so the row
     * shows a clock time instead of repeating "15 Mar" down the whole section.
     */
    timeOnly: boolean;
    /** Opens the thread. */
    onSelect(): void;
    /**
     * Opens the rename dialog on this thread.
     *
     * Handed a callback that puts focus back on this row's menu button. The
     * dialog is opened *from a menu item*, which unmounts as the menu closes —
     * so Radix has nothing left to restore focus to and drops it on `<body>`,
     * stranding a keyboard user at the top of the page.
     */
    onRename(returnFocus: () => void): void;
    /** Files it away, or brings it back — whichever this list is showing. */
    onToggleArchived(): void;
}

/** One thread in the rail: what it was about, when it was last used, and its menu. */
export function AgentsRailRow({
    conversation,
    active,
    timeOnly,
    onSelect,
    onRename,
    onToggleArchived
}: AgentsRailRowProps) {
    const intl = useIntl();
    const menuRef = useRef<HTMLButtonElement>(null);
    const title = conversation.title ?? intl.formatMessage(messages.untitled);

    return (
        // `group` drives the menu button's reveal on hover. The row is a
        // *relative* container so the button can sit over the title's text
        // rather than stealing width from it — a second column would truncate
        // every title in the rail to make room for a control most rows never
        // need.
        <li className="group/row relative">
            <button
                type="button"
                onClick={onSelect}
                // `aria-current="page"` rather than a styled-only selection:
                // this is a list of destinations and the open one has to be
                // announced, not merely tinted.
                {...(active ? { 'aria-current': 'page' as const } : {})}
                className={cn(
                    'focus-visible:ring-ring flex w-full flex-col items-start gap-0.5 rounded-md py-1.5 pr-8 pl-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
                    active
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/60'
                )}
            >
                <span
                    className={cn(
                        'w-full truncate text-sm',
                        active && 'font-medium'
                    )}
                >
                    {title}
                </span>
                <span className="text-muted-foreground text-[11px]">
                    {intl.formatDate(
                        conversation.updatedAt,
                        timeOnly
                            ? { hour: 'numeric', minute: '2-digit' }
                            : { month: 'short', day: 'numeric' }
                    )}
                </span>
            </button>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    {/* Hidden until hover **or focus** — `focus-visible` alone
                        would leave it invisible while its own menu is open, and
                        `group-focus-within` is what keeps it reachable by
                        keyboard at all. */}
                    <Button
                        ref={menuRef}
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground absolute top-1 right-1 size-6 opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 data-[state=open]:opacity-100"
                        aria-label={intl.formatMessage(messages.actions, {
                            title
                        })}
                    >
                        <MoreHorizontal className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem
                        onSelect={() =>
                            onRename(() => menuRef.current?.focus())
                        }
                    >
                        <Pencil className="size-3.5" />
                        {intl.formatMessage(messages.rename)}
                    </DropdownMenuItem>
                    {/* Archiving is reversible and loses nothing, so it takes no
                        confirm step and no destructive styling — the row simply
                        moves to the other list, and the same menu brings it
                        back. There is no Delete: a thread's proposals are the
                        receipts for changes actually made to your content. */}
                    <DropdownMenuItem onSelect={onToggleArchived}>
                        {conversation.archived ? (
                            <>
                                <ArchiveRestore className="size-3.5" />
                                {intl.formatMessage(messages.unarchive)}
                            </>
                        ) : (
                            <>
                                <Archive className="size-3.5" />
                                {intl.formatMessage(messages.archive)}
                            </>
                        )}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </li>
    );
}
