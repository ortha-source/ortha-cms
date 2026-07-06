import { collection, field } from '@ortha-cms/content-server/define';

/**
 * Authors — the "one" side of a one-to-many with {@link article} (one author
 * writes many articles). An article carries the `author_id` foreign key; the
 * inverse (an author's articles) is read from that column, so this collection
 * needs no relation field of its own.
 *
 * Also **localized** (`i18n: true`): each author has a row per locale sharing a
 * `locale_group_id`. Because the target is localizable, `article.author` becomes
 * a **per-locale** relation — an EN article links an EN author, a DE article a
 * DE author; the link is never shared across locales. `bio` varies per locale;
 * `name`/`email` are shared across the group.
 */
export const author = collection('author', {
    label: 'Authors',
    description: 'People who write articles.',
    publishable: true,
    paranoid: true,
    i18n: true,
    fields: {
        name: field.text({
            required: true,
            minLength: 1,
            maxLength: 120,
            admin: {
                label: 'Name',
                description: "The author's display name.",
                placeholder: 'e.g. Ada Lovelace'
            }
        }),
        email: field.text({
            admin: {
                label: 'Email',
                description: 'Contact email.',
                placeholder: 'e.g. ada@example.com'
            }
        }),
        bio: field.richtext({
            localized: true,
            admin: {
                label: 'Bio',
                widget: 'textarea',
                description: 'A short biography.',
                placeholder: 'A sentence or two about the author…'
            }
        })
    }
});
