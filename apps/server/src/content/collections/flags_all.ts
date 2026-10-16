// @orthacms-generated — managed by the Schema Builder.

/**
 * `flags_all` — the same two fields under different type flags, so the only
 * difference between the `flags_*` types is the flags. Publishable, paranoid and translated at once.
 */

import { collection, field } from '@orthacms/content-server/define';

export const flags_all = collection('flags_all', {
    label: 'Flags · All',
    description: 'Publishable, paranoid and translated at once.',
    publishable: true,
    paranoid: true,
    i18n: true,
    fields: {
        title: field.text({ required: true, localized: true }),
        body: field.richtext({ required: true, localized: true })
    }
});
