// @orthacms-generated — managed by the Schema Builder.

/**
 * `flags_none` — the same two fields under different type flags, so the only
 * difference between the `flags_*` types is the flags. No flags: every save is final, delete is permanent.
 */

import { collection, field } from '@orthacms/content-server/define';

export const flags_none = collection('flags_none', {
    label: 'Flags · None',
    description: 'No flags: every save is final, delete is permanent.',

    fields: {
        title: field.text({ required: true }),
        body: field.richtext({ required: true })
    }
});
