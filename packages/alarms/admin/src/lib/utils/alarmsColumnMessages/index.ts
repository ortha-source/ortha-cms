import { defineMessages } from 'react-intl';

/**
 * Messages the plugin factory itself needs.
 *
 * `RECORDS_COLUMN_SLOT` takes a `MessageDescriptor` for the column label rather
 * than a rendered string — the column picker formats it — so this one
 * descriptor lives outside a component. Everything else in the package
 * co-locates its `defineMessages` with the component that renders it.
 */
export const alarmsColumnMessages = defineMessages({
    column: { id: 'alarms.records.column', defaultMessage: 'Checks' }
});
