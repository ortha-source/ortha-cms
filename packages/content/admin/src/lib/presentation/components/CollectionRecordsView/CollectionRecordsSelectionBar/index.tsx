import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { X } from 'lucide-react';
import { Button } from '@orthacms/design-system';

/** Intl descriptors for {@link CollectionRecordsSelectionBar}, co-located. */
const messages = defineMessages({
    count: {
        id: 'content.records.selection.count',
        defaultMessage: '{count, plural, one {# selected} other {# selected}}'
    },
    of: {
        id: 'content.records.selection.of',
        defaultMessage: 'of {total}'
    },
    label: {
        id: 'content.records.selection.label',
        defaultMessage: 'Selection'
    },
    clear: {
        id: 'content.records.selection.clear',
        defaultMessage: 'Clear selection'
    }
});

/**
 * The selection bar: while rows are selected it **takes the toolbar's place**
 * above the table instead of pushing the table down — a dark strip with
 * "{n} selected of {total}", the caller's bulk `actions` (buttons, the
 * destructive one at the far end) and a **✕** that clears.
 *
 * Clear stays its own control, outside the actions, because it is the way
 * *out* of a state the user may have entered by accident — it never sits in a
 * menu beside Delete.
 *
 * The count here is **visual only** — the bar mounts and unmounts with the
 * selection, so it can't be a reliable live region; the spoken announcement
 * lives in a persistent region in `LoadedRecordsView`.
 */
export function CollectionRecordsSelectionBar({
    count,
    total,
    actions,
    onClear
}: {
    /** Number of currently selected records. */
    count: number;
    /** Records in the list, for "of N". */
    total?: number;
    /** Bulk action controls for the current selection. */
    actions?: ReactNode;
    /** Clears the selection. */
    onClear: () => void;
}) {
    const intl = useIntl();

    return (
        <div
            role="group"
            aria-label={intl.formatMessage(messages.label)}
            className="mb-3 flex min-h-10 flex-wrap items-center gap-1 rounded-xl bg-foreground py-1 pl-4 pr-1.5 text-background"
        >
            <span className="mr-2 flex items-baseline gap-1.5 text-sm">
                <span className="font-medium">
                    {intl.formatMessage(messages.count, { count })}
                </span>
                {total !== undefined ? (
                    <span className="text-xs text-background/65">
                        {intl.formatMessage(messages.of, {
                            total: intl.formatNumber(total)
                        })}
                    </span>
                ) : null}
            </span>
            <span
                aria-hidden
                className="mx-1 h-4 w-px shrink-0 bg-background/25"
            />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
                {actions}
            </div>
            <span
                aria-hidden
                className="mx-1 h-4 w-px shrink-0 bg-background/25"
            />
            <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-background hover:bg-background/10 hover:text-background"
                onClick={onClear}
                aria-label={intl.formatMessage(messages.clear)}
            >
                <X aria-hidden />
            </Button>
        </div>
    );
}
