import { collection, field } from '@ortha-cms/content-server/define';

/**
 * SEO metadata — the far side of a one-to-one with {@link article}. An article
 * owns at most one SEO record and a given record is owned by at most one
 * article; that uniqueness is enforced by the `unique: true` single relation on
 * {@link article}, which generates a `UNIQUE` constraint on its `seo_id` FK.
 */
export const seoMeta = collection('seo_meta', {
    label: 'SEO metadata',
    description: 'Search-engine metadata attached one-to-one to an article.',
    fields: {
        metaTitle: field.text({
            maxLength: 70,
            admin: {
                label: 'Meta title',
                description: 'Title tag (≤ 70 characters).',
                placeholder: 'e.g. Getting started with Ortha'
            }
        }),
        metaDescription: field.text({
            maxLength: 160,
            admin: {
                label: 'Meta description',
                widget: 'textarea',
                description: 'Description meta tag (≤ 160 characters).',
                placeholder: 'A concise summary for search results…'
            }
        }),
        canonicalUrl: field.text({
            admin: {
                label: 'Canonical URL',
                description: 'The canonical URL for this content.',
                placeholder: 'e.g. https://example.com/posts/hello'
            }
        })
    }
});
