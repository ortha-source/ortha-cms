import type {
    BuilderCapabilities,
    FieldDoc,
    FieldEntry,
    SchemaDocumentEnvelope,
    TypeDoc
} from '@orthacms/schema-builder-domain';

/** A field entry keyed the way the server keys a loaded field. */
export function entry(type: string, name: string, spec: FieldDoc): FieldEntry {
    return { key: `${type}.${name}`, name, spec };
}

/** A collection with defaults for everything a spec does not care about. */
export function typeDoc(
    over: Partial<TypeDoc> & Pick<TypeDoc, 'name'>
): TypeDoc {
    return {
        kind: 'collection',
        publishable: false,
        paranoid: false,
        i18n: false,
        groups: [],
        fields: [],
        origin: 'code',
        ...over
    };
}

/** The envelope the document route answers. */
export function envelopeOf(
    types: TypeDoc[],
    capabilities: BuilderCapabilities = {
        editable: false,
        reason: 'disabled',
        restart: 'watch'
    }
): SchemaDocumentEnvelope {
    return {
        document: { version: 1, types },
        fingerprint: '0123456789abcdef',
        bootId: 'boot',
        capabilities
    };
}

/** An article with a field on every tab and one group — the page specs' model. */
export const article = typeDoc({
    name: 'article',
    label: 'Articles',
    description: 'Long-form posts.',
    publishable: true,
    paranoid: true,
    i18n: true,
    groups: [
        {
            key: 'seo',
            label: 'SEO',
            description: 'Search engines',
            collapsed: true
        }
    ],
    fields: [
        entry('article', 'body', { type: 'richtext', localized: true }),
        entry('article', 'title', {
            type: 'text',
            required: true,
            admin: { label: 'Title' }
        }),
        entry('article', 'kind', {
            type: 'select',
            options: ['news', 'opinion']
        }),
        entry('article', 'author', { type: 'relation', to: 'author' }),
        entry('article', 'cover', { type: 'media', multiple: true }),
        entry('article', 'slug', { type: 'text', admin: { group: 'seo' } })
    ]
});

/** A second collection and a page, so the rail has both sections. */
export const author = typeDoc({
    name: 'author',
    fields: [entry('author', 'name', { type: 'text' })]
});
export const home = typeDoc({
    name: 'home',
    kind: 'single',
    path: '/',
    label: 'Home',
    fields: []
});
