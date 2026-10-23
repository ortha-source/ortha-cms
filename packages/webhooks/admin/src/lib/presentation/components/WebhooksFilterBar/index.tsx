import { defineMessages, useIntl } from 'react-intl';
import { Search } from 'lucide-react';
import { cn, Input } from '@orthacms/design-system';
import type { WebhookState } from '../../../domain/webhookHealth';

/** Which endpoints the list shows: every one, or those in one state. */
export type WebhookFilter = 'all' | WebhookState;

const messages = defineMessages({
    group: { id: 'webhooks.filter.group', defaultMessage: 'Show' },
    all: { id: 'webhooks.filter.all', defaultMessage: 'All' },
    active: { id: 'webhooks.filter.active', defaultMessage: 'Healthy' },
    paused: { id: 'webhooks.filter.paused', defaultMessage: 'Paused' },
    stopped: { id: 'webhooks.filter.stopped', defaultMessage: 'Stopped' },
    search: {
        id: 'webhooks.filter.search',
        defaultMessage: 'Search webhooks'
    }
});

const FILTERS: WebhookFilter[] = ['all', 'active', 'paused', 'stopped'];

type WebhooksFilterBarProps = {
    filter: WebhookFilter;
    onFilterChange: (next: WebhookFilter) => void;
    counts: Record<WebhookFilter, number>;
    query: string;
    onQueryChange: (next: string) => void;
};

/**
 * The list's filter row: a segmented All / Healthy / Paused / Stopped with
 * counts (Stopped marked red while any is), and a search over name and URL.
 */
export function WebhooksFilterBar({
    filter,
    onFilterChange,
    counts,
    query,
    onQueryChange
}: WebhooksFilterBarProps) {
    const intl = useIntl();

    return (
        <div className="flex flex-wrap items-center gap-3">
            <div
                role="group"
                aria-label={intl.formatMessage(messages.group)}
                className="inline-flex gap-0.5 rounded-lg bg-muted p-[3px]"
            >
                {FILTERS.map((value) => (
                    <button
                        key={value}
                        type="button"
                        aria-pressed={filter === value}
                        onClick={() => onFilterChange(value)}
                        className={cn(
                            'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            filter === value &&
                                'bg-background text-foreground shadow-xs'
                        )}
                    >
                        {value === 'stopped' && counts.stopped > 0 ? (
                            <span
                                aria-hidden
                                className="size-1.5 rounded-full bg-destructive"
                            />
                        ) : null}
                        {intl.formatMessage(messages[value])}
                        <span className="tabular-nums text-muted-foreground">
                            {counts[value]}
                        </span>
                    </button>
                ))}
            </div>
            <div className="relative ml-auto w-full sm:w-64">
                <Search
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                    type="search"
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                    placeholder={intl.formatMessage(messages.search)}
                    aria-label={intl.formatMessage(messages.search)}
                    className="h-8 pl-8"
                />
            </div>
        </div>
    );
}
