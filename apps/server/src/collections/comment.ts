import { collection, field } from '@ortha-cms/content-server/define';
import { article } from './article';

/**
 * Comments — the "many" side of a one-to-many with {@link article} (one article
 * has many comments). The relation is a required single relation **on this
 * collection**, producing an `article_id` FK column on `content_comment`; that
 * single FK is exactly how a one-to-many is stored (the "one" side owns no
 * column). `onDelete` defaults to `'cascade'` because the relation is required,
 * so deleting an article removes its comments.
 */
export const comment = collection('comment', {
    label: 'Comments',
    description: 'Reader comments belonging to a single article.',
    fields: {
        author: field.text({
            required: true,
            minLength: 1,
            maxLength: 120,
            admin: {
                label: 'Author',
                description: 'Name of the commenter.',
                placeholder: 'e.g. Anonymous'
            }
        }),
        body: field.richtext({
            required: true,
            admin: {
                label: 'Body',
                widget: 'textarea',
                description: 'The comment text.',
                placeholder: 'Write a comment…'
            }
        }),
        article: field.relation({
            to: () => article,
            required: true,
            admin: {
                label: 'Article',
                description: 'The article this comment belongs to.'
            }
        })
    }
});
