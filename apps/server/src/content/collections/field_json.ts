// @orthacms-generated — managed by the Schema Builder.

/**
 * `field_json` — the JSON escape hatch, optional and required.
 */

import { collection, field } from '@orthacms/content-server/define';

export const field_json = collection('field_json', {
    label: 'Field · JSON',
    description: 'JSON: optional and required.',
    fields: {
        title: field.text({ required: true }),
        json: field.json(),
        required_json: field.json({ required: true })
    }
});
