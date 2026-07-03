import { type Page } from '@playwright/test';
import { type WorkspaceView } from './workspaces';

/** A content-type summary as `GET /api/content-schema` returns it. */
interface ContentTypeSummary {
    name: string;
    kind: 'collection' | 'single';
    label: string;
    description?: string;
    path?: string;
    /** Has a draft/published `status` envelope column. */
    publishable?: boolean;
}

/** One field as `GET /api/content-schema/:name` returns it. */
interface ContentFieldSchema {
    name: string;
    type: string;
    required: boolean;
    validation: Record<string, unknown>;
    admin: Record<string, unknown>;
    options?: string[];
    relation?: {
        to: string;
        many: boolean;
        onDelete?: string;
        unique?: boolean;
        inverse?: { field: string };
    };
}

/** A content type with its full field schema (the `:name` detail route). */
interface ContentTypeDetail extends ContentTypeSummary {
    fields: ContentFieldSchema[];
}

/**
 * The content-type catalogue the schema endpoint returns: two collections
 * (Blog posts, Products) and two pages (Home, About). Slugs line up with the
 * grants on {@link LIBRARY_WORKSPACE} / {@link SCOPED_WORKSPACE}.
 */
export const CONTENT_SCHEMA_SEED: ContentTypeSummary[] = [
    { name: 'blog_post', kind: 'collection', label: 'Blog posts' },
    { name: 'product', kind: 'collection', label: 'Products' },
    { name: 'home', kind: 'single', label: 'Home', path: '/' },
    { name: 'about', kind: 'single', label: 'About', path: '/about' }
];

/**
 * Full field schemas for the seed collections, returned by the
 * `GET /api/content-schema/:name` detail route the records table reads. The
 * field order drives the default columns (first four non-heavy fields + Status +
 * Updated), and `category`'s options drive the select filter + cell badge.
 */
export const CONTENT_DETAIL_SEED: Record<string, ContentTypeDetail> = {
    blog_post: {
        name: 'blog_post',
        kind: 'collection',
        label: 'Blog posts',
        publishable: true,
        fields: [
            {
                name: 'title',
                type: 'text',
                required: true,
                validation: {},
                admin: { label: 'Title' }
            },
            {
                name: 'excerpt',
                type: 'richtext',
                required: false,
                validation: {},
                admin: { label: 'Excerpt' }
            },
            {
                name: 'price',
                type: 'money',
                required: false,
                validation: {},
                admin: { label: 'Price' }
            },
            {
                name: 'published',
                type: 'boolean',
                required: false,
                validation: {},
                admin: { label: 'Published' }
            },
            {
                name: 'category',
                type: 'select',
                required: false,
                validation: {},
                admin: { label: 'Category' },
                options: ['news', 'guide', 'release']
            },
            {
                name: 'publishedAt',
                type: 'datetime',
                required: false,
                validation: {},
                admin: { label: 'Published at' }
            }
        ]
    },
    product: {
        name: 'product',
        kind: 'collection',
        label: 'Products',
        publishable: true,
        fields: [
            {
                name: 'name',
                type: 'text',
                required: true,
                validation: {},
                admin: { label: 'Name' }
            },
            {
                name: 'price',
                type: 'money',
                required: true,
                validation: {},
                admin: { label: 'Price' }
            }
        ]
    },
    home: {
        name: 'home',
        kind: 'single',
        label: 'Home',
        path: '/',
        fields: [
            {
                name: 'heading',
                type: 'text',
                required: true,
                validation: {},
                admin: { label: 'Heading' }
            }
        ]
    },
    about: {
        name: 'about',
        kind: 'single',
        label: 'About',
        path: '/about',
        fields: [
            {
                name: 'heading',
                type: 'text',
                required: true,
                validation: {},
                admin: { label: 'Heading' }
            }
        ]
    }
};

/**
 * Schema seed for the **relations** suite. `article` exercises every
 * cardinality: a single many-to-one (`author`), a unique one-to-one (`seo`), and
 * a many-to-many (`tags`); `tag.articles` is the inverse of `article.tags`. The
 * candidate rows for these targets are served by {@link mockContentEntries} from
 * {@link RELATIONS_ENTRIES_SEED} (the real `GET /api/content/:type` path).
 */
export const RELATIONS_SCHEMA_SEED: ContentTypeSummary[] = [
    {
        name: 'article',
        kind: 'collection',
        label: 'Articles',
        publishable: true
    },
    { name: 'author', kind: 'collection', label: 'Authors' },
    { name: 'tag', kind: 'collection', label: 'Tags' },
    { name: 'seo_meta', kind: 'collection', label: 'SEO metadata' }
];

/** Full field schemas for the relations suite (article + its three targets). */
export const RELATIONS_DETAIL_SEED: Record<string, ContentTypeDetail> = {
    article: {
        name: 'article',
        kind: 'collection',
        label: 'Articles',
        publishable: true,
        fields: [
            {
                // Named `text` to match the app's baked-in article candidate
                // values (`useRelationCandidates`), so an article's title
                // resolves when it's the *target* of the tag→articles inverse.
                name: 'text',
                type: 'text',
                required: true,
                validation: {},
                admin: { label: 'Title' }
            },
            {
                name: 'author',
                type: 'relation',
                required: false,
                validation: {},
                admin: { label: 'Author' },
                relation: { to: 'author', many: false, onDelete: 'set null' }
            },
            {
                name: 'seo',
                type: 'relation',
                required: false,
                validation: {},
                admin: { label: 'SEO metadata' },
                relation: {
                    to: 'seo_meta',
                    many: false,
                    onDelete: 'set null',
                    unique: true
                }
            },
            {
                name: 'tags',
                type: 'relation',
                required: false,
                validation: {},
                admin: { label: 'Tags' },
                relation: { to: 'tag', many: true }
            }
        ]
    },
    author: {
        name: 'author',
        kind: 'collection',
        label: 'Authors',
        fields: [
            {
                name: 'name',
                type: 'text',
                required: true,
                validation: {},
                admin: { label: 'Name' }
            },
            {
                name: 'email',
                type: 'text',
                required: false,
                validation: {},
                admin: { label: 'Email' }
            },
            {
                name: 'bio',
                type: 'richtext',
                required: false,
                validation: {},
                admin: { label: 'Bio' }
            }
        ]
    },
    tag: {
        name: 'tag',
        kind: 'collection',
        label: 'Tags',
        fields: [
            {
                name: 'name',
                type: 'text',
                required: true,
                validation: {},
                admin: { label: 'Name' }
            },
            {
                name: 'slug',
                type: 'text',
                required: false,
                validation: {},
                admin: { label: 'Slug' }
            },
            {
                // Inverse (two-way) of article.tags — editable from the tag side.
                name: 'articles',
                type: 'relation',
                required: false,
                validation: {},
                admin: { label: 'Articles' },
                relation: {
                    to: 'article',
                    many: true,
                    inverse: { field: 'tags' }
                }
            }
        ]
    },
    seo_meta: {
        name: 'seo_meta',
        kind: 'collection',
        label: 'SEO metadata',
        fields: [
            {
                name: 'metaTitle',
                type: 'text',
                required: false,
                validation: {},
                admin: { label: 'Meta title' }
            },
            {
                name: 'metaDescription',
                type: 'text',
                required: false,
                validation: {},
                admin: { label: 'Meta description' }
            }
        ]
    }
};

/** Build an entry row from an id + values (stable timestamps). */
function seedRow(
    id: string,
    values: Record<string, unknown>,
    status?: 'draft' | 'published'
): EntryRecord {
    const at = '2026-01-01T00:00:00.000Z';
    return {
        id,
        ...(status ? { status } : {}),
        createdAt: at,
        updatedAt: at,
        values
    };
}

/** The 32 tag names the lazy-scroll test pages through (window of 12). */
const RELATION_TAG_NAMES = [
    'engineering',
    'design',
    'product',
    'research',
    'announcement',
    'tutorial',
    'guide',
    'release',
    'security',
    'performance',
    'accessibility',
    'culture',
    'hiring',
    'remote',
    'open-source',
    'frontend',
    'backend',
    'database',
    'devops',
    'testing',
    'mobile',
    'ai',
    'data',
    'ux',
    'marketing',
    'support',
    'community',
    'roadmap',
    'changelog',
    'beta',
    'launch',
    'retro'
];

/**
 * Friendly candidate rows for the **relations** suite, keyed by target type and
 * served through {@link mockContentEntries} (the real `GET /api/content/:type`
 * path the picker now reads). Titles are recognizable (`author.name`, `tag.name`,
 * `article.text`) so the picker assertions read naturally; `tag` has 32 rows so
 * the lazy-scroll window (12) has something to page through.
 */
export const RELATIONS_ENTRIES_SEED: Record<string, EntryRecord[]> = {
    author: [
        seedRow('author-ada', { name: 'Ada Lovelace' }),
        seedRow('author-grace', { name: 'Grace Hopper' }),
        seedRow('author-alan', { name: 'Alan Turing' }),
        seedRow('author-katherine', { name: 'Katherine Johnson' }),
        seedRow('author-margaret', { name: 'Margaret Hamilton' })
    ],
    tag: RELATION_TAG_NAMES.map((name, i) =>
        seedRow(`tag-${String(i + 1).padStart(2, '0')}`, { name, slug: name })
    ),
    article: [
        seedRow(
            'article-getting-started',
            { text: 'Getting started with Ortha' },
            'published'
        ),
        seedRow('article-scaling', { text: 'Scaling Postgres' }, 'draft'),
        seedRow('article-design', { text: 'Designing the CMS' }, 'published')
    ],
    seo_meta: [
        seedRow('seo-home', { metaTitle: 'Home — Ortha' }),
        seedRow('seo-blog', { metaTitle: 'Blog — Ortha' })
    ]
};

const ADA: WorkspaceView['members'][number] = {
    id: 'u_ada',
    name: 'Ada Lovelace',
    email: 'ada@ortha.dev'
};

/** A workspace granted every content type — the default Content Library seed. */
export const LIBRARY_WORKSPACE: WorkspaceView = {
    id: 'ws_lib',
    name: 'Library demo',
    slug: 'library-demo',
    description: 'Workspace used by the Content Library e2e suite.',
    color: 'violet',
    status: 'active',
    members: [ADA],
    content: ['blog_post', 'product', 'home', 'about']
};

/** A workspace granted the relations-suite types (article + its targets). */
export const RELATIONS_WORKSPACE: WorkspaceView = {
    ...LIBRARY_WORKSPACE,
    id: 'ws_rel',
    name: 'Relations demo',
    slug: 'relations-demo',
    content: ['article', 'author', 'tag', 'seo_meta']
};

/**
 * A relations workspace granted `article` + `author` + `seo_meta` but **not**
 * `tag` — so the editor must hide `article`'s `tags` relation (its target
 * collection isn't reachable here).
 */
export const RELATIONS_SCOPED_WORKSPACE: WorkspaceView = {
    ...RELATIONS_WORKSPACE,
    id: 'ws_rel_scoped',
    name: 'Relations scoped demo',
    slug: 'relations-scoped-demo',
    content: ['article', 'author', 'seo_meta']
};

/** A workspace granted only a subset — one collection + one page. */
export const SCOPED_WORKSPACE: WorkspaceView = {
    ...LIBRARY_WORKSPACE,
    id: 'ws_scoped',
    name: 'Scoped demo',
    slug: 'scoped-demo',
    content: ['blog_post', 'home']
};

/** A workspace granted no content — exercises the empty state. */
export const UNGRANTED_WORKSPACE: WorkspaceView = {
    ...LIBRARY_WORKSPACE,
    id: 'ws_empty',
    name: 'Empty demo',
    slug: 'empty-demo',
    content: []
};

interface ContentSchemaOptions {
    /** Types the endpoint returns. Defaults to {@link CONTENT_SCHEMA_SEED}. */
    types?: ContentTypeSummary[];
    /** Response status; use a 5xx to exercise the error state. */
    status?: number;
    /** Hold the response open this long, to observe the loading skeleton. */
    delayMs?: number;
}

/**
 * Stub `GET /api/content-schema` — the registry's source of truth the Content
 * Library reads via `useContentTypes`. Anchored so it doesn't also match the
 * (unused) `GET /api/content-schema/:name` detail route. Scoped to the test's
 * `page`, so it resets with the browser context.
 */
export async function mockContentSchema(
    page: Page,
    {
        types = CONTENT_SCHEMA_SEED,
        status = 200,
        delayMs
    }: ContentSchemaOptions = {}
): Promise<void> {
    await page.route(/\/api\/content-schema(\?.*)?$/, async (route) => {
        if (delayMs) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        await route.fulfill({
            status,
            contentType: 'application/json',
            body: JSON.stringify(
                status >= 400 ? { message: 'Server error' } : types
            )
        });
    });
}

interface ContentSchemaDetailOptions {
    /** Detail schemas keyed by type name. Defaults to {@link CONTENT_DETAIL_SEED}. */
    details?: Record<string, ContentTypeDetail>;
    /** Response status; use a 5xx to exercise the error state. */
    status?: number;
}

/**
 * Stub `GET /api/content-schema/:name` — the full field schema the records table
 * reads via `useContentSchema`. Resolves the `:name` from the URL against
 * {@link CONTENT_DETAIL_SEED}; an unknown name 404s. Register alongside
 * {@link mockContentSchema} for any test that opens a collection.
 */
export async function mockContentSchemaDetail(
    page: Page,
    {
        details = CONTENT_DETAIL_SEED,
        status = 200
    }: ContentSchemaDetailOptions = {}
): Promise<void> {
    await page.route(/\/api\/content-schema\/([^/?]+)/, async (route) => {
        if (status >= 400) {
            await route.fulfill({
                status,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Server error' })
            });
            return;
        }
        const name = decodeURIComponent(
            new URL(route.request().url()).pathname.split('/').pop() ?? ''
        );
        const detail = details[name];
        await route.fulfill({
            status: detail ? 200 : 404,
            contentType: 'application/json',
            body: JSON.stringify(detail ?? { message: 'Not found' })
        });
    });
}

/** One fabricated entry row, as `GET /api/content/:name` returns it. */
interface EntryRecord {
    id: string;
    status?: 'draft' | 'published';
    createdAt: string;
    updatedAt: string;
    values: Record<string, unknown>;
}

/** Rows per page the records table requests by default. */
const ENTRY_PAGE_SIZE = 10;
/** How many rows each collection gets — enough to exceed one page. */
const ENTRY_COUNT = 23;

/** A deterministic value for one field at row `i` — type-shaped, stable per run. */
function valueFor(field: ContentFieldSchema, i: number): unknown {
    const label =
        typeof field.admin.label === 'string' ? field.admin.label : field.name;
    const day = new Date(Date.UTC(2026, 0, 1 + (i % 27)));
    switch (field.type) {
        case 'text':
            // Zero-padded ordinal so the rendered cells sort lexicographically.
            return `${label} ${String(i + 1).padStart(2, '0')}`;
        case 'richtext':
            return `Body copy for row ${i + 1}.`;
        case 'number':
            return (i * 7) % 100;
        case 'money':
            return ((i % 9) + 1) * 1000 - 1;
        case 'boolean':
            return i % 2 === 0;
        case 'date':
            return day.toISOString().slice(0, 10);
        case 'datetime':
            return day.toISOString();
        case 'select':
            return field.options?.length
                ? field.options[i % field.options.length]
                : null;
        case 'multiselect':
            return field.options?.length
                ? [field.options[i % field.options.length]]
                : [];
        case 'json':
            return { row: i + 1 };
        case 'relation':
            return field.relation?.many ? [`Ref ${i + 1}`] : `Ref ${i + 1}`;
        default:
            return null;
    }
}

/** Generate the deterministic entry list for a collection from its schema. */
function entriesFor(detail: ContentTypeDetail): EntryRecord[] {
    return Array.from({ length: ENTRY_COUNT }, (_, i) => {
        const values: Record<string, unknown> = {};
        for (const field of detail.fields)
            values[field.name] = valueFor(field, i);
        const day = new Date(Date.UTC(2026, 0, 1 + (i % 27))).toISOString();
        return {
            id: `${detail.name}-${String(i + 1).padStart(2, '0')}`,
            ...(detail.publishable
                ? { status: i % 3 === 0 ? 'draft' : 'published' }
                : {}),
            createdAt: day,
            updatedAt: day,
            values
        } as EntryRecord;
    });
}

/** True when any of a record's textual values (or status) contains the needle. */
function matchesSearch(record: EntryRecord, search: string): boolean {
    const needle = search.toLowerCase();
    if (record.status?.includes(needle)) return true;
    return Object.values(record.values).some((value) => {
        if (value == null) return false;
        const text = Array.isArray(value)
            ? value.join(' ')
            : typeof value === 'object'
              ? JSON.stringify(value)
              : String(value);
        return text.toLowerCase().includes(needle);
    });
}

/** The comparable value for a record under a sort column. */
function sortValue(record: EntryRecord, columnId: string): string | number {
    if (columnId === 'status') return record.status ?? '';
    if (columnId === 'updatedAt') return Date.parse(record.updatedAt);
    const value = record.values[columnId];
    if (value == null) return '';
    return typeof value === 'number' ? value : String(value);
}

/** Sort a copy of `rows` by a sort spec (`col` asc, `-col` desc). */
function applySort(rows: EntryRecord[], sort: string): EntryRecord[] {
    if (!sort) return rows;
    const desc = sort.startsWith('-');
    const columnId = desc ? sort.slice(1) : sort;
    if (!columnId) return rows;
    const factor = desc ? -1 : 1;
    return [...rows].sort((a, b) => {
        const av = sortValue(a, columnId);
        const bv = sortValue(b, columnId);
        const cmp =
            typeof av === 'number' && typeof bv === 'number'
                ? av - bv
                : String(av).localeCompare(String(bv));
        return cmp * factor;
    });
}

interface ContentEntriesOptions {
    /** Detail schemas to fabricate rows from. Defaults to {@link CONTENT_DETAIL_SEED}. */
    details?: Record<string, ContentTypeDetail>;
    /**
     * Explicit row sets per type name — used verbatim (still searched/sorted/
     * paginated) instead of the schema-fabricated rows. Lets the relations suite
     * serve recognizable candidate titles (see {@link RELATIONS_ENTRIES_SEED}).
     */
    entries?: Record<string, EntryRecord[]>;
    /** Response status; use a 5xx to exercise the error state. */
    status?: number;
}

/**
 * Stub `GET /api/content/:name` — the records-list endpoint `useContentEntries`
 * reads. Fabricates a deterministic row set from the type's detail schema, then
 * applies the request's `?search=` / `?sort=` / `?page=` / `?pageSize=` exactly
 * as the server would, returning the `{ items, total, page, pageSize }` envelope.
 * Register alongside {@link mockContentSchemaDetail} for any test that opens a
 * collection's records table.
 */
export async function mockContentEntries(
    page: Page,
    {
        details = CONTENT_DETAIL_SEED,
        entries,
        status = 200
    }: ContentEntriesOptions = {}
): Promise<void> {
    await page.route(/\/api\/content\/([^/?]+)(\?.*)?$/, async (route) => {
        if (status >= 400) {
            await route.fulfill({
                status,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Server error' })
            });
            return;
        }
        const url = new URL(route.request().url());
        const name = decodeURIComponent(
            url.pathname.split('/').pop() ?? ''
        ).split('?')[0];
        const detail = details[name];
        const override = entries?.[name];
        if (!detail && !override) {
            await route.fulfill({
                status: 404,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Not found' })
            });
            return;
        }

        const params = url.searchParams;
        const search = params.get('search') ?? '';
        const sort = params.get('sort') ?? '';
        const pageNum = Number(params.get('page') ?? '1');
        const pageSize = Number(
            params.get('pageSize') ?? String(ENTRY_PAGE_SIZE)
        );

        const all = override ?? entriesFor(detail as ContentTypeDetail);
        const searched = search
            ? all.filter((row) => matchesSearch(row, search))
            : all;
        const sorted = applySort(searched, sort);
        const start = (pageNum - 1) * pageSize;

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                items: sorted.slice(start, start + pageSize),
                total: sorted.length,
                page: pageNum,
                pageSize
            })
        });
    });
}

/** A linked record on a relation field, as the relations read returns it. */
interface RelationRefSeed {
    id: string;
    title: string;
    status?: 'draft' | 'published';
}

interface EntryRelationsOptions {
    /**
     * Assigned links keyed by `"<type>/<id>"` then field name. A missing entry
     * (e.g. a brand-new record) resolves to no links. Defaults to empty — the
     * relations suite edits new entries, which have nothing linked yet.
     */
    relations?: Record<string, Record<string, RelationRefSeed[]>>;
}

/**
 * Stub `GET /api/content/:name/:id/relations` — the assigned-relations read the
 * editor loads (`useEntryRelations`) to seed single-relation values and the
 * section header counts. Wraps each field's seeded refs in the paginated
 * `{ items, total }` envelope the server now returns. An entry not in the seed
 * resolves to no links. Register **after** {@link mockContentEntryWrites} so this
 * more specific route wins the `/…/:id/relations` match.
 */
export async function mockEntryRelations(
    page: Page,
    { relations = {} }: EntryRelationsOptions = {}
): Promise<void> {
    await page.route(
        /\/api\/content\/[^/?]+\/[^/?]+\/relations(\?.*)?$/,
        async (route) => {
            const parts = new URL(route.request().url()).pathname
                .split('/')
                .filter(Boolean);
            // ['api','content',name,id,'relations']
            const key = `${decodeURIComponent(
                parts[2] ?? ''
            )}/${decodeURIComponent(parts[3] ?? '')}`;
            const fields = relations[key] ?? {};
            const view = Object.fromEntries(
                Object.entries(fields).map(([field, refs]) => [
                    field,
                    { items: refs, total: refs.length }
                ])
            );
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ relations: view })
            });
        }
    );
}

/** A JSON 200 fulfilment helper for the write mocks. */
function json(
    route: import('@playwright/test').Route,
    body: unknown,
    status = 200
) {
    return route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body)
    });
}

/**
 * Stub the entry **write** API the editor, row menu, and selection bar drive:
 * read-one (`GET /api/content/:name/:id`), create (`POST /api/content/:name`),
 * update (`PATCH`), publish/unpublish/restore, soft/permanent delete, and the
 * `/bulk/...` routes. Deterministic echoes — enough for the admin to navigate,
 * toast, and invalidate. The create route `fallback()`s non-POST requests so the
 * single-segment list mock ({@link mockContentEntries}) still handles `GET`.
 * Register alongside the list mocks for any test that edits or acts on entries.
 */
export async function mockContentEntryWrites(
    page: Page,
    { details = CONTENT_DETAIL_SEED }: ContentEntriesOptions = {}
): Promise<void> {
    const now = '2026-01-01T00:00:00.000Z';

    // Multi-segment routes: read-one, item writes, and bulk.
    await page.route(/\/api\/content\/[^/?]+\/.+/, async (route) => {
        const req = route.request();
        const method = req.method();
        const parts = new URL(req.url()).pathname.split('/').filter(Boolean);
        // ['api','content',name,id|'bulk', action?, sub?]
        const name = decodeURIComponent(parts[2] ?? '');
        const id = decodeURIComponent(parts[3] ?? '');
        const action = parts[4];
        const detail = details[name];
        const body = (req.postDataJSON?.() ?? {}) as {
            ids?: string[];
            values?: Record<string, unknown>;
        };

        if (id === 'bulk') {
            const ids = body.ids ?? [];
            if (action === 'publish' && parts[5] === 'preview') {
                return json(route, {
                    items: ids.map((entryId) => ({
                        id: entryId,
                        title: entryId,
                        status: 'draft',
                        verdict: 'publishable',
                        issues: []
                    }))
                });
            }
            if (action === 'publish') {
                return json(route, { published: ids, skipped: [] });
            }
            // unpublish / delete / restore / purge
            return json(route, { count: ids.length });
        }

        const record = (status: 'draft' | 'published') => ({
            id,
            ...(detail?.publishable ? { status } : {}),
            createdAt: now,
            updatedAt: now,
            values:
                body.values ??
                detail?.fields.reduce<Record<string, unknown>>((acc, f) => {
                    acc[f.name] = valueFor(f, 0);
                    return acc;
                }, {}) ??
                {}
        });

        if (method === 'GET') return json(route, record('draft'));
        if (method === 'PATCH') return json(route, record('draft'));
        if (method === 'DELETE')
            return route.fulfill({ status: 204, body: '' });
        if (method === 'POST') {
            // publish → published; unpublish/restore → draft
            return json(
                route,
                record(action === 'publish' ? 'published' : 'draft'),
                201
            );
        }
        return route.fallback();
    });

    // Create lives on the single-segment path the list mock also owns; only
    // claim POST and defer everything else to the list mock.
    await page.route(/\/api\/content\/[^/?]+(\?.*)?$/, async (route) => {
        const req = route.request();
        if (req.method() !== 'POST') return route.fallback();
        const name = decodeURIComponent(
            new URL(req.url()).pathname.split('/').pop() ?? ''
        ).split('?')[0];
        const detail = details[name];
        const body = (req.postDataJSON?.() ?? {}) as {
            values?: Record<string, unknown>;
        };
        return json(
            route,
            {
                id: `${name}-new`,
                ...(detail?.publishable ? { status: 'draft' } : {}),
                createdAt: now,
                updatedAt: now,
                values: body.values ?? {}
            },
            201
        );
    });
}
