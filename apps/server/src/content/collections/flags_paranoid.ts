// @orthacms-generated — managed by the Schema Builder.

/**
 * `flags_paranoid` — the same two fields under different type flags, so the only
 * difference between the `flags_*` types is the flags. Delete moves to the trash; restore or purge.
 */

import { collection, field } from '@orthacms/content-server/define';

export const flags_paranoid = collection('flags_paranoid', {
    label: 'Flags · Paranoid',
    description: 'Delete moves to the trash; restore or purge.',
    paranoid: true,
    fields: {
        title: field.text({ required: true }),
        body: field.richtext({ required: true })
    }
});
