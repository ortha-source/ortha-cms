// @orthacms-generated — managed by the Schema Builder.

/**
 * `field_select` — single and multiple choice, optional and required.
 */

import { collection, field } from '@orthacms/content-server/define';

export const field_select = collection('field_select', {
    label: 'Field · Select',
    description: 'Select and multiselect, optional and required.',
    fields: {
        title: field.text({ required: true }),
        select: field.select({ options: ['alpha', 'beta', 'gamma'] }),
        required_select: field.select({
            options: ['small', 'medium', 'large'],
            required: true
        }),
        multiselect: field.multiselect({
            options: ['red', 'green', 'blue', 'yellow']
        }),
        required_multiselect: field.multiselect({
            options: ['web', 'ios', 'android'],
            required: true
        })
    }
});
