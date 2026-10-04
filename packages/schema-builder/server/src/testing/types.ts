import {
    collection,
    field,
    single,
    type AnyContentType
} from '@orthacms/content-server/define';

/**
 * A small model that reaches every branch of the document mapping: every
 * validation key, groups, a relation in each shape, an inverse, a single.
 */
export const author = collection('sb_author', {
    i18n: true,
    fields: {
        name: field.text({ required: true, localized: true, maxLength: 80 }),
        posts: field.relationInverse({
            of: (): AnyContentType => post,
            field: 'author'
        }),
        primary: field.relationInverse({
            of: (): AnyContentType => post,
            field: 'lead',
            many: false
        })
    }
});

export const post = collection('sb_post', {
    label: 'Posts',
    description: 'Blog posts.',
    publishable: true,
    paranoid: true,
    i18n: true,
    groups: {
        seo: { label: 'SEO', description: 'Search', collapsed: true },
        misc: { label: 'Misc' }
    },
    fields: {
        title: field.text({
            required: true,
            localized: true,
            minLength: 3,
            pattern: '^[A-Z]',
            admin: { placeholder: 'Title', future: { kept: true } }
        }),
        body: field.richtext({
            maxLength: 5000,
            structure: 'on',
            lang: 'en'
        }),
        rating: field.number({ integer: true, min: 0, max: 5 }),
        price: field.money({ min: 0 }),
        kind: field.select({ options: ['a', 'b'] as const }),
        tags: field.multiselect({ options: ['x'] as const }),
        cover: field.media({
            accept: { kinds: ['image'], mimeTypes: ['image/png'] }
        }),
        gallery: field.media({ multiple: true }),
        slug: field.text({ admin: { group: 'seo' } }),
        note: field.text({ admin: { group: 'misc' } }),
        author: field.relation({ to: () => author }),
        lead: field.relation({ to: () => author, unique: true }),
        owner: field.relation({ to: () => author, required: true }),
        keep: field.relation({ to: () => author, onDelete: 'restrict' }),
        related: field.relation({ to: (): AnyContentType => post, many: true }),
        local: field.relation({ to: () => author, syncAcrossLocales: false })
    }
});

export const home = single('sb_home', {
    path: '/',
    label: 'sb_home',
    fields: { headline: field.text() }
});

export const TYPES: readonly AnyContentType[] = [author, post, home];
