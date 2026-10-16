// @orthacms-generated — managed by the Schema Builder.

/**
 * `field_boolean` — an optional boolean (null, true or false) and a required
 * one (a column DEFAULT false).
 */

import { collection, field } from '@orthacms/content-server/define';

export const field_boolean = collection('field_boolean', {
    label: 'Field · Boolean',
    description: 'Boolean: optional and required.',
    fields: {
        title: field.text({ required: true }),
        flag: field.boolean(),
        required_flag: field.boolean({ required: true })
    }
});
