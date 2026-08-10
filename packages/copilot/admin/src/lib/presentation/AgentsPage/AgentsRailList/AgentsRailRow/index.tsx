import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@ortha-cms/design-system';
import type { CopilotConversation } from '../../../../application/useConversations';

const messages = defineMessages({
    // The rail's own word for a thread with no server-derived title yet.
    // Deliberately not "New chat": that is the name of the button above the
    // list, and two controls in one region answering to the same name is
    // ambiguous by voice and in a screen reader's control list.
    untitled: {
        id: 'copilot.agents.rail.untitled',
        defaultMessage: 'Untitled chat'
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
}

/** One thread in the rail: what it was about, and when it was last used. */
export function AgentsRailRow({
    conversation,
    active,
    timeOnly,
    onSelect
}: AgentsRailRowProps) {
    const intl = useIntl();
    const title = conversation.title ?? intl.formatMessage(messages.untitled);

    return (
        <li>
            <button
                type="button"
                onClick={onSelect}
                // `aria-current="page"` rather than a styled-only selection:
                // this is a list of destinations and the open one has to be
                // announced, not merely tinted.
                {...(active ? { 'aria-current': 'page' as const } : {})}
                className={cn(
                    'focus-visible:ring-ring flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
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
        </li>
    );
}
