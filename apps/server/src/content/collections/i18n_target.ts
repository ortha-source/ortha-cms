// @orthacms-generated — managed by the Schema Builder.

/**
 * `i18n_target` — a translated target. A synced link to it is **mirrored**:
 * each sibling links the target's row in its own language.
 */

import { collection, field } from '@orthacms/content-server/define';

export const i18n_target = collection('i18n_target', {
    label: 'I18n · Target',
    description: 'A translated target for mirrored links.',
    publishable: true,
    paranoid: true,
    i18n: true,
    fields: {
        name: field.text({ required: true, localized: true })
    }
});
