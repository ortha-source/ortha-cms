import { defineMessages, useIntl } from 'react-intl';
import { Button } from '@ortha-cms/design-system';

/** Intl descriptors for {@link CollectionRecordsSelectionBar}, co-located. */
const messages = defineMessages({
    count: {
        id: 'content.records.selection.count',
        defaultMessage: '{count, plural, one {# selected} other {# selected}}'
    },
    clear: {
        id: 'content.records.selection.clear',
        defaultMessage: 'Clear'
    }
});

/**
 * The selection summary bar shown above the table once one or more rows are
 * selected: a live "{n} selected" count and a Clear action. Bulk actions
 * (delete, publish) land with the real entry API; for now this just reflects and
 * clears the selection. The count is a `role="status"` live region so assistive
 * tech hears the selection change.
 */
export function CollectionRecordsSelectionBar({
    count,
    onClear
}: {
    /** Number of currently selected records. */
    count: number;
    /** Clears the selection. */
    onClear: () => void;
}) {
    const intl = useIntl();

    return (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-2">
            <span role="status" aria-live="polite" className="text-sm font-medium">
                {intl.formatMessage(messages.count, { count })}
            </span>
            <Button
                variant="outline"
                size="sm"
                className="shadow-none"
                onClick={onClear}
            >
                {intl.formatMessage(messages.clear)}
            </Button>
        </div>
    );
}
