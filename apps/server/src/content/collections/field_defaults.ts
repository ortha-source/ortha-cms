// @orthacms-generated — managed by the Schema Builder.

/**
 * `field_defaults` — a `defaultValue` on every type that takes one. A default
 * is a create-form prefill and a column DEFAULT; relations and media take none.
 */

import { collection, field } from '@orthacms/content-server/define';

export const field_defaults = collection('field_defaults', {
    label: 'Field · Defaults',
    description: 'A default value on every scalar and choice type.',
    fields: {
        text: field.text({ defaultValue: 'Untitled' }),
        number: field.number({ defaultValue: 42 }),
        money: field.money({ defaultValue: 1999 }),
        boolean: field.boolean({ defaultValue: true }),
        date: field.date({ defaultValue: '2026-01-01' }),
        select: field.select({
            options: ['draft', 'review', 'final'],
            defaultValue: 'review'
        }),
        multiselect: field.multiselect({
            options: ['email', 'sms', 'push'],
            defaultValue: ['email', 'push']
        })
    }
});
