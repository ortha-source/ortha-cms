// @orthacms-generated — managed by the Schema Builder.

/**
 * `single_i18n` — a single that is publishable and translated: one row per
 * language, each published on its own.
 */

import { single, field } from '@orthacms/content-server/define';

export const single_i18n = single('single_i18n', {
    label: 'Single · I18n',
    description: 'A publishable, translated single.',
    path: '/single-i18n',
    publishable: true,
    i18n: true,
    fields: {
        headline: field.text({ required: true, localized: true }),
        body: field.richtext({ localized: true }),
        theme: field.select({
            options: ['light', 'dark', 'brand'],
            admin: { description: 'Shared across languages.' }
        })
    }
});
