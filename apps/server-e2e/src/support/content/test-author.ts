import {
    collection,
    field,
    type AnyContentType
} from '@orthacms/content-server/define';
import { testArticle } from './test-article';

/**
 * `test_author` — the e2e-owned equivalent of the app's `author`. The "one"
 * side of a one-to-many with {@link testArticle} (one author writes many
 * articles); the FK lives on `test_article.author`. `articles` is the inverse
 * of `test_article.contributors`, the many-to-many.
 *
 * **Localized** (`i18n: true`): each author has a row per locale sharing a
 * `locale_group_id`. Because the target is localizable, `test_article.author`
 * becomes a **per-locale** relation — the i18n spec's "does not sync a relation
 * to a localizable target across locales" case depends on this. `bio` varies per
 * locale; `name`/`email` are shared across the group.
 *
 * Owned by the server-e2e harness — NOT imported from `apps/server`.
 */
export const testAuthor = collection('test_author', {
    label: 'Test authors',
    description: 'People who write test articles.',
    publishable: true,
    paranoid: true,
    i18n: true,
    fields: {
        name: field.text({
            required: true,
            minLength: 1,
            maxLength: 120,
            admin: { label: 'Name', description: "The author's display name." }
        }),
        email: field.text({
            admin: { label: 'Email', description: 'Contact email.' }
        }),
        bio: field.richtext({
            localized: true,
            admin: {
                label: 'Bio',
                widget: 'textarea',
                description: 'A short biography.'
            }
        }),
        // The far side of `test_article.contributors` — a **mirrored**
        // many-to-many, so linking an article from here is an edit to that
        // article's links in this author's locale, and the article's other
        // translations have to follow it. Virtual: no column, no migration.
        articles: field.relationInverse({
            of: (): AnyContentType => testArticle,
            field: 'contributors',
            admin: { label: 'Articles' }
        })
    }
});
