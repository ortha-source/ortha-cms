import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { SelectionBar } from '@orthacms/design-system';

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
 * The records list's selection bar — the design-system `SelectionBar`, which
 * floats a light card at the bottom centre of the work area while rows are
 * selected: "{n} selected of {total}", the caller's bulk `actions` (buttons,
 * the destructive ones after a divider) and a **✕** that clears. The toolbar
 * above the table stays where it is.
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
        <SelectionBar
            label={intl.formatMessage(messages.label)}
            clearLabel={intl.formatMessage(messages.clear)}
            onClear={onClear}
            count={
                <>
                    <span className="font-medium">
                        {intl.formatMessage(messages.count, { count })}
                    </span>
                    {total !== undefined ? (
                        <span className="text-xs text-muted-foreground">
                            {intl.formatMessage(messages.of, {
                                total: intl.formatNumber(total)
                            })}
                        </span>
                    ) : null}
                </>
            }
        >
            {actions}
        </SelectionBar>
    );
}
