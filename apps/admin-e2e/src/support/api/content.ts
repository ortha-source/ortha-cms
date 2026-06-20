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
