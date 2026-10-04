import { type Page } from '@playwright/test';

/** A field entry as the document route returns it. */
export interface FieldEntrySeed {
    key: string;
    name: string;
    spec: Record<string, unknown> & { type: string };
}

/** A type as the document route returns it. */
export interface TypeDocSeed {
    name: string;
    kind: 'collection' | 'single';
    path?: string;
    label?: string;
    description?: string;
    publishable: boolean;
    paranoid: boolean;
    i18n: boolean;
    groups: {
        key: string;
        label: string;
        description?: string;
        collapsed?: boolean;
    }[];
    fields: FieldEntrySeed[];
    origin: 'builder' | 'code' | 'new';
}

/** `GET /api/schema-builder/document` — the server's envelope. */
export interface SchemaEnvelopeSeed {
    document: { version: 1; types: TypeDocSeed[] };
    fingerprint: string;
    bootId: string;
    capabilities: {
        editable: boolean;
        reason?: 'production' | 'disabled' | 'no-source-tree';
        restart: 'watch' | 'manual';
    };
}

const field = (
    type: string,
    name: string,
    spec: FieldEntrySeed['spec']
): FieldEntrySeed => ({
    key: `${type}.${name}`,
    name,
    spec
});

/**
 * The reference model the suites assert against: an i18n article with a field
 * on every built-in tab and one General-tab group (declared out of rank order,
 * so the rank ordering is observable), an author, and a page.
 */
export const SCHEMA_TYPES_SEED: TypeDocSeed[] = [
    {
        name: 'article',
        kind: 'collection',
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
            field('article', 'body', { type: 'richtext', localized: true }),
            field('article', 'title', {
                type: 'text',
                required: true,
                admin: { label: 'Title' }
            }),
            field('article', 'kind', {
                type: 'select',
                options: ['news', 'opinion']
            }),
            field('article', 'author', { type: 'relation', to: 'author' }),
            field('article', 'cover', {
                type: 'media',
                accept: { kinds: ['image'] }
            }),
            field('article', 'slug', { type: 'text', admin: { group: 'seo' } })
        ],
        origin: 'code'
    },
    {
        name: 'author',
        kind: 'collection',
        label: 'Authors',
        publishable: false,
        paranoid: false,
        i18n: false,
        groups: [],
        fields: [
            field('author', 'name', { type: 'text', required: true }),
            field('author', 'articles', {
                type: 'relation',
                to: 'article',
                inverseOf: 'author'
            })
        ],
        origin: 'builder'
    },
    {
        name: 'home',
        kind: 'single',
        path: '/',
        label: 'Home',
        publishable: true,
        paranoid: false,
        i18n: false,
        groups: [],
        fields: [field('home', 'headline', { type: 'text' })],
        origin: 'code'
    }
];

/** Options for {@link mockSchemaDocument}. */
export interface SchemaDocumentOptions {
    types?: TypeDocSeed[];
    capabilities?: SchemaEnvelopeSeed['capabilities'];
    /** Answer `500` — the shared client retries before the error state shows. */
    fails?: boolean;
    /** Hold the response open, to observe the loading state. */
    delayMs?: number;
}

/**
 * Stub `GET /api/schema-builder/document`. Returns a counter, so a spec can
 * assert the page sent no request at all (the no-access state).
 */
export async function mockSchemaDocument(
    page: Page,
    {
        types = SCHEMA_TYPES_SEED,
        capabilities = {
            editable: false,
            reason: 'disabled',
            restart: 'watch'
        },
        fails = false,
        delayMs
    }: SchemaDocumentOptions = {}
): Promise<{ readonly count: number }> {
    const calls = { count: 0 };
    await page.route('**/api/schema-builder/document', async (route) => {
        calls.count += 1;
        if (delayMs)
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        if (fails) {
            return route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: '{"message":"boom"}'
            });
        }
        const body: SchemaEnvelopeSeed = {
            document: { version: 1, types },
            fingerprint: '0123456789abcdef',
            bootId: 'boot-e2e',
            capabilities
        };
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(body)
        });
    });
    return calls;
}
