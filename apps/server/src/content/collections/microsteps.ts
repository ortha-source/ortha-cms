// @orthacms-generated — managed by the Schema Builder.
// Remove the line above to take this type over by hand; the builder will then show it read-only.

import {
    collection,
    field,
    type AnyContentType
} from '@orthacms/content-server/define';
import { article } from './article';

export const microsteps = collection('microsteps', {
    label: 'Microsteps',
    publishable: true,
    i18n: true,
    fields: {
        title: field.text({ required: true, localized: true }),
        description: field.richtext({ admin: { label: 'Description' } }),
        articles: field.relation({
            to: (): AnyContentType => article,
            required: true,
            unique: true,
            admin: { label: 'Articles' }
        }),
        image: field.media({
            accept: { kinds: ['image'] },
            admin: { label: 'image' }
        }),
        depricatedAt: field.date({
            required: true,
            localized: true,
            admin: { label: 'Depricated At' }
        }),
        body: field.richtext({
            localized: true,
            structure: 'on',
            admin: { label: 'Body', widget: 'textarea' }
        })
    }
});
