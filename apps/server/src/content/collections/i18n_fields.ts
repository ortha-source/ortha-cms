// @orthacms-generated — managed by the Schema Builder.

/**
 * `i18n_fields` — translated (`localized`) and shared fields side by side, of
 * each kind that can be either. Editing a shared field rewrites every
 * translation; editing a localized one touches only this locale.
 */

import { collection, field } from '@orthacms/content-server/define';

export const i18n_fields = collection('i18n_fields', {
    label: 'I18n · Fields',
    description: 'Localized and shared fields of each kind.',
    publishable: true,
    i18n: true,
    fields: {
        title: field.text({ required: true, localized: true }),
        slug: field.text({
            localized: true,
            pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
            admin: { widget: 'slug' }
        }),
        summary: field.text({
            localized: true,
            admin: { widget: 'textarea' }
        }),
        body: field.richtext({ localized: true }),
        code: field.text({
            admin: { description: 'Shared: one value for every language.' }
        }),
        price: field.money({ admin: { description: 'Shared.' } }),
        audience: field.select({
            options: ['everyone', 'members', 'staff'],
            admin: { description: 'Shared.' }
        }),
        cover: field.media({
            localized: true,
            accept: { kinds: ['image'] },
            admin: { description: 'One image per language.' }
        }),
        logo: field.media({
            accept: { kinds: ['image'] },
            admin: { description: 'Shared: one image for every language.' }
        })
    }
});
