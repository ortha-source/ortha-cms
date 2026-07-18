import { collection, field } from '@ortha-cms/content-server/define';
import { testArticle } from './test-article';

/**
 * `test_comment` — the e2e-owned equivalent of the app's `comment`. The "many"
 * side of a one-to-many with {@link testArticle} (one article has many
 * comments). The relation is a **required** single relation on this collection,
 * producing an `article_id` FK column — exactly how a one-to-many is stored (the
 * "one" side owns no column). `onDelete` defaults to `'cascade'` for a required
 * relation, so deleting an article removes its comments.
 *
 * No spec drives this type directly; it exists to preserve the model's
 * one-to-many-with-required-cascade coverage (schema shape) alongside the
 * author↔article one-to-many. Owned by the server-e2e harness.
 */
export const testComment = collection('test_comment', {
    label: 'Test comments',
    description: 'Reader comments belonging to a single test article.',
    fields: {
        author: field.text({
            required: true,
            minLength: 1,
            maxLength: 120,
            admin: { label: 'Author', description: 'Name of the commenter.' }
        }),
        body: field.richtext({
            required: true,
            admin: {
                label: 'Body',
                widget: 'textarea',
                description: 'The comment text.'
            }
        }),
        article: field.relation({
            to: () => testArticle,
            required: true,
            admin: {
                label: 'Article',
                description: 'The article this comment belongs to.'
            }
        })
    }
});
