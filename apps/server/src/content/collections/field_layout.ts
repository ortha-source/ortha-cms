// @orthacms-generated — managed by the Schema Builder.

/**
 * `field_layout` — how the entry form is laid out: collapsible groups (one
 * collapsed by default), rows, half-width fields, a hidden field, labels,
 * descriptions and placeholders. Presentation only — no storage effect.
 */

import { collection, field } from '@orthacms/content-server/define';

export const field_layout = collection('field_layout', {
    label: 'Field · Layout',
    description: 'Groups, rows, widths, hidden fields, labels.',
    groups: {
        contact: { label: 'Contact', description: 'Two half-width fields.' },
        schedule: { label: 'Schedule' },
        advanced: {
            label: 'Advanced',
            description: 'Collapsed until opened.',
            collapsed: true
        }
    },
    fields: {
        title: field.text({
            required: true,
            admin: {
                label: 'Headline',
                description: 'Above every group.',
                placeholder: 'A headline'
            }
        }),
        first_name: field.text({ admin: { group: 'contact', width: 'half' } }),
        last_name: field.text({ admin: { group: 'contact', width: 'half' } }),
        starts_on: field.date({ admin: { group: 'schedule', row: 'range' } }),
        ends_on: field.date({ admin: { group: 'schedule', row: 'range' } }),
        notes: field.text({
            admin: { group: 'advanced', widget: 'textarea' }
        }),
        internal_id: field.text({ admin: { group: 'advanced', hidden: true } })
    }
});
