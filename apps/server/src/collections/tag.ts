import { collection, field } from '@ortha-cms/content-server/define';

/**
 * Tags — the far side of a many-to-many with {@link article}. An article links
 * to any number of tags and a tag is shared by any number of articles; the
 * links live in the generated `content_article_tags` join table (declared by
 * the `many: true` relation on {@link article}), so this collection needs no
 * relation field of its own.
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
        })
    }
});
