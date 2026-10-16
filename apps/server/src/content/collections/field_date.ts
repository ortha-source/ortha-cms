// @orthacms-generated — managed by the Schema Builder.

/**
 * `field_date` — a calendar date, an instant, and a required date.
 */

import { collection, field } from '@orthacms/content-server/define';

export const field_date = collection('field_date', {
    label: 'Field · Date',
    description: 'Date and datetime, optional and required.',
    fields: {
        title: field.text({ required: true }),
        date: field.date({ admin: { row: 'when' } }),
        datetime: field.datetime({ admin: { row: 'when' } }),
        required_date: field.date({ required: true })
    }
});
