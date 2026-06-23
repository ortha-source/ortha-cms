import { defineMessages, useIntl } from 'react-intl';
import { fieldLabel, type EntryColumn } from '../../utils/entryColumns';
import { COLUMN_KIND } from '../../constants';

/** Header labels for the envelope columns, co-located per the i18n convention. */
const messages = defineMessages({
    status: { id: 'content.records.column.status', defaultMessage: 'Status' },
    updated: { id: 'content.records.column.updated', defaultMessage: 'Updated' }
});

/**
 * Returns a function that maps a column to its localized label: the
 * `Status`/`Updated` envelope labels, or a field's own admin/humanized label.
 * Shared by the records table header and the column picker.
 */
export function useColumnLabel(): (column: EntryColumn) => string {
    const intl = useIntl();
    return (column: EntryColumn): string => {
        switch (column.kind) {
            case COLUMN_KIND.Status:
                return intl.formatMessage(messages.status);
            case COLUMN_KIND.Updated:
                return intl.formatMessage(messages.updated);
            case COLUMN_KIND.Field:
                return fieldLabel(column.field);
        }
    };
}
