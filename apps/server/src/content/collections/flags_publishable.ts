// @orthacms-generated — managed by the Schema Builder.

/**
 * `flags_publishable` — the same two fields under different type flags, so the only
 * difference between the `flags_*` types is the flags. Draft, published and Modified; required checked at publish.
 */

import { collection, field } from '@orthacms/content-server/define';

export const flags_publishable = collection('flags_publishable', {
    label: 'Flags · Publishable',
    description: 'Draft, published and Modified; required checked at publish.',
    publishable: true,
    fields: {
        title: field.text({ required: true }),
        body: field.richtext({ required: true })
    }
});
