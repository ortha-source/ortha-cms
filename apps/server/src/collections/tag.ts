import {
    collection,
    field,
    type AnyContentType
} from '@ortha-cms/content-server/define';
import { article } from './article';

/**
 * Tags — the far side of a many-to-many with {@link article}. The links live in
 * the generated `content_article_tags` join table (declared by the `many: true`
 * relation on {@link article}); `articles` below is that relation's **inverse**
 * (a two-way relation), so the link is editable from the tag side too — it owns
 * no storage of its own and mutates the same join rows.
 */
export const tag = collection('tag', {
    label: 'Tags',
    description: 'Free-form labels shared across articles.',
    fields: {
        name: field.text({
            required: true,
            minLength: 1,
            maxLength: 60,
            admin: {
                label: 'Name',
                description: 'The tag label.',
                placeholder: 'e.g. engineering'
            }
        }),
        slug: field.text({
            pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
            admin: {
                label: 'Slug',
                widget: 'slug',
                description: 'URL-safe identifier (lowercase, hyphenated).',
                placeholder: 'e.g. engineering'
            }
        }),
        // Inverse of article.tags — the both-sided view of the same link.
        // The thunk's return is annotated `AnyContentType` to break the
        // article⇄tag type-inference cycle (each would otherwise need the
        // other's inferred type); the registry still resolves it at runtime.
        articles: field.relationInverse({
            of: (): AnyContentType => article,
            field: 'tags',
            admin: {
                label: 'Articles',
                description:
                    'Articles tagged with this tag (editable both ways).'
            }
        })
    }
});
