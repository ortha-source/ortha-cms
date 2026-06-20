import { type Page } from '@playwright/test';
import { type WorkspaceView } from './workspaces';

/** A content-type summary as `GET /api/content-schema` returns it. */
interface ContentTypeSummary {
    name: string;
    kind: 'collection' | 'single';
    label: string;
    description?: string;
    path?: string;
}

/** One field as `GET /api/content-schema/:name` returns it. */
interface ContentFieldSchema {
    name: string;
    type: string;
    required: boolean;
    validation: Record<string, unknown>;
    admin: Record<string, unknown>;
    options?: string[];
    relation?: { to: string; many: boolean; onDelete?: string };
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
    }
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
    { details = CONTENT_DETAIL_SEED, status = 200 }: ContentSchemaDetailOptions = {}
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
