// @orthacms-generated — managed by the Schema Builder.

/**
 * `field_richtext` — rich text with and without structure checking, required
 * and bounded.
 */

import { collection, field } from '@orthacms/content-server/define';

export const field_richtext = collection('field_richtext', {
    label: 'Field · Rich text',
    description: 'Rich text: required, bounded, structure on and off.',
    fields: {
        plain: field.richtext(),
        required: field.richtext({ required: true }),
        bounded: field.richtext({
            maxLength: 2000,
            admin: { description: 'At most 2000 characters.' }
        }),
        unstructured: field.richtext({
            structure: 'off',
            admin: { description: 'Heading order and link text not checked.' }
        })
    }
});
