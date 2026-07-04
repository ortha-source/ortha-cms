import { collection, field } from '@ortha-cms/content-server/define';

/**
 * Authors — the "one" side of a one-to-many with {@link article} (one author
 * writes many articles). An article carries the `author_id` foreign key; the
 * inverse (an author's articles) is read from that column, so this collection
 * needs no relation field of its own.
 */
export const author = collection('author', {
    label: 'Authors',
    description: 'People who write articles.',
    publishable: true,
    paranoid: true,
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
            admin: {
                label: 'Bio',
                widget: 'textarea',
                description: 'A short biography.',
                placeholder: 'A sentence or two about the author…'
            }
        })
    }
});
