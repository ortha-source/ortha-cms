// @orthacms-generated — managed by the Schema Builder.

/**
 * `single_plain` — a single page with no flags: one row, saved in place.
 */

import { single, field } from '@orthacms/content-server/define';

export const single_plain = single('single_plain', {
    label: 'Single · Plain',
    description: 'A single with no flags.',
    path: '/single-plain',
    fields: {
        headline: field.text({ required: true }),
        body: field.richtext(),
        contact_email: field.text({
            pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$',
            admin: { widget: 'email' }
        })
    }
});
