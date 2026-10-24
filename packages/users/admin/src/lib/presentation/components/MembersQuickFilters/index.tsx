import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@orthacms/design-system';
import type { MemberCounts } from '../../../domain/types/member';
import {
    MEMBERS_QUICK_FILTERS,
    quickFilterCount,
    type MembersQuickFilter
} from '../../membersQuickFilter';

/** Intl descriptors for {@link MembersQuickFilters}, co-located. */
const messages = defineMessages({
    group: {
        id: 'users.quickFilters.group',
        defaultMessage: 'Show members'
    },
    everyone: { id: 'users.quickFilters.everyone', defaultMessage: 'Everyone' },
    admins: { id: 'users.quickFilters.admins', defaultMessage: 'Admins' },
    invited: { id: 'users.quickFilters.invited', defaultMessage: 'Invited' },
    disabled: { id: 'users.quickFilters.disabled', defaultMessage: 'Disabled' }
});

/**
 * Everyone · Admins · Invited · Disabled at the head of the roster's toolbar —
 * the usual questions in one click, the full filter builder still behind its
 * icon. Toggle buttons (`aria-pressed`), exactly one pressed; each shows the
 * directory-wide count once the list has answered. Same chip as the records
 * page's status chips, so the two lists read alike.
 */
export function MembersQuickFilters({
    value,
    counts,
    onChange
}: {
    /** The active view. */
    value: MembersQuickFilter;
    /** Directory-wide counts, once known. */
    counts?: MemberCounts;
    /** Selects a view. */
    onChange: (next: MembersQuickFilter) => void;
}) {
    const intl = useIntl();
    return (
        <div
            role="group"
            aria-label={intl.formatMessage(messages.group)}
            className="flex flex-wrap items-center gap-1.5"
        >
            {MEMBERS_QUICK_FILTERS.map((filter) => {
                const on = value === filter;
                return (
                    <button
                        key={filter}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onChange(filter)}
                        className={cn(
                            'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                            on
                                ? 'border-foreground bg-foreground text-background'
                                : 'bg-background text-foreground hover:bg-muted'
                        )}
                    >
                        {intl.formatMessage(messages[filter])}
                        {counts ? (
                            <span
                                className={cn(
                                    'font-normal tabular-nums',
                                    on
                                        ? 'text-background/70'
                                        : 'text-muted-foreground'
                                )}
                            >
                                {intl.formatNumber(
                                    quickFilterCount(filter, counts)
                                )}
                            </span>
                        ) : null}
                    </button>
                );
            })}
        </div>
    );
}
