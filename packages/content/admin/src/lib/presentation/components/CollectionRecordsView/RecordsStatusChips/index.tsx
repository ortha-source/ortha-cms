import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@orthacms/design-system';
import { newId, type FilterGroup } from '@orthacms/query-builder-admin';
import {
    QUICK_STATUS,
    activeQuickStatus,
    withQuickStatus,
    type QuickStatus
} from '../../../statusQuickFilter';

/** Intl descriptors for {@link RecordsStatusChips}, co-located. */
const messages = defineMessages({
    group: {
        id: 'content.records.statusChips.group',
        defaultMessage: 'Show by status'
    },
    published: {
        id: 'content.records.statusChips.published',
        defaultMessage: 'Published'
    },
    modified: {
        id: 'content.records.statusChips.modified',
        defaultMessage: 'Modified'
    },
    draft: {
        id: 'content.records.statusChips.draft',
        defaultMessage: 'Draft'
    }
});

const ORDER: { status: QuickStatus; label: keyof typeof messages }[] = [
    { status: QUICK_STATUS.Published, label: 'published' },
    { status: QUICK_STATUS.Modified, label: 'modified' },
    { status: QUICK_STATUS.Draft, label: 'draft' }
];

/**
 * Published · Modified · Draft as one-click filters at the head of the records
 * toolbar, each with the type's count when it is known. A chip is a pair of
 * ordinary conditions (`statusQuickFilter`), so picking one keeps every other
 * condition applied, picking another swaps it, and pressing the lit one clears
 * it. Toggle buttons (`aria-pressed`), at most one pressed.
 */
export function RecordsStatusChips({
    tree,
    counts,
    onChange
}: {
    /** The applied filter. */
    tree: FilterGroup | null;
    /** Per-chip totals, when known. */
    counts?: Record<QuickStatus, number>;
    /** Commits the next filter. */
    onChange: (next: FilterGroup | null) => void;
}) {
    const intl = useIntl();
    const active = activeQuickStatus(tree);
    return (
        <div
            role="group"
            aria-label={intl.formatMessage(messages.group)}
            className="flex flex-wrap items-center gap-1.5"
        >
            {ORDER.map(({ status, label }) => {
                const on = active === status;
                return (
                    <button
                        key={status}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                            onChange(
                                withQuickStatus(tree, on ? null : status, newId)
                            )
                        }
                        className={cn(
                            'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                            on
                                ? 'border-foreground bg-foreground text-background'
                                : 'bg-background text-foreground hover:bg-muted'
                        )}
                    >
                        {intl.formatMessage(messages[label])}
                        {counts ? (
                            <span
                                className={cn(
                                    'font-normal tabular-nums',
                                    on
                                        ? 'text-background/70'
                                        : 'text-muted-foreground'
                                )}
                            >
                                {intl.formatNumber(counts[status])}
                            </span>
                        ) : null}
                    </button>
                );
            })}
        </div>
    );
}
