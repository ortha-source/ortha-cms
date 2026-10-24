import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@orthacms/design-system';
import type {
    ApiTokenStatus,
    ApiTokenSummary
} from '../../../domain/types/apiToken';

const messages = defineMessages({
    group: {
        id: 'apiTokens.chips.group',
        defaultMessage: 'Show by status'
    },
    active: { id: 'apiTokens.chips.active', defaultMessage: 'Active' },
    expired: { id: 'apiTokens.chips.expired', defaultMessage: 'Expired' },
    revoked: { id: 'apiTokens.chips.revoked', defaultMessage: 'Revoked' },
    option: {
        id: 'apiTokens.chips.option',
        defaultMessage:
            '{label}, {count, plural, one {# token} other {# tokens}}'
    }
});

/** The chips, in the order the list shows them. Active is the default view. */
export const STATUS_CHIPS: readonly ApiTokenStatus[] = [
    'active',
    'expired',
    'revoked'
];

/**
 * Active · Expired · Revoked as one-click filters at the head of the list, each
 * with how many tokens it would show. Exactly one is always on — old tokens
 * are a click away instead of filling the table — so pressing the lit chip
 * does nothing. Toggle buttons (`aria-pressed`), styled like the records
 * page's status chips.
 */
export function ApiTokensStatusChips({
    value,
    summary,
    onChange
}: {
    value: ApiTokenStatus;
    /** Per-status totals; counts are omitted until the first page lands. */
    summary?: ApiTokenSummary;
    onChange: (next: ApiTokenStatus) => void;
}) {
    const intl = useIntl();
    return (
        <div
            role="group"
            aria-label={intl.formatMessage(messages.group)}
            className="flex flex-wrap items-center gap-1.5"
        >
            {STATUS_CHIPS.map((status) => {
                const on = value === status;
                const label = intl.formatMessage(messages[status]);
                const count = summary?.[status];
                return (
                    <button
                        key={status}
                        type="button"
                        aria-pressed={on}
                        // The count is decision-shaping ("Revoked" hiding one
                        // leaked key reads differently from none), so it rides
                        // in the name rather than as a stray number after it.
                        aria-label={
                            count === undefined
                                ? undefined
                                : intl.formatMessage(messages.option, {
                                      label,
                                      count
                                  })
                        }
                        onClick={() => {
                            if (!on) {
                                onChange(status);
                            }
                        }}
                        className={cn(
                            'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                            on
                                ? 'border-foreground bg-foreground text-background'
                                : 'bg-background text-foreground hover:bg-muted'
                        )}
                    >
                        {label}
                        {count === undefined ? null : (
                            <span
                                aria-hidden
                                className={cn(
                                    'font-normal tabular-nums',
                                    on
                                        ? 'text-background/70'
                                        : 'text-muted-foreground'
                                )}
                            >
                                {intl.formatNumber(count)}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
