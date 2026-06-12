import { type Page } from '@playwright/test';

/** A member as the server's `GET /api/workspaces` returns it. */
interface WorkspaceMemberView {
    id: string;
    name: string | null;
    email: string;
}

/** A workspace as the server's `GET /api/workspaces` returns it. */
interface WorkspaceView {
    id: string;
    name: string;
    slug: string;
    description: string;
    color: string;
    status: 'active' | 'archived';
    members: WorkspaceMemberView[];
}

/** A small, deterministic default list — the FE analog of seeded rows. */
const DEFAULT_WORKSPACES: WorkspaceView[] = [
    {
        id: 'ws_marketing',
        name: 'Marketing site',
        slug: 'marketing-site',
        description: 'Landing pages, the blog, and campaign content.',
        color: 'violet',
        status: 'active',
        members: [
            { id: 'u_ada', name: 'Ada Lovelace', email: 'ada@ortha.dev' },
            { id: 'u_grace', name: 'Grace Hopper', email: 'grace@ortha.dev' }
        ]
    },
    {
        id: 'ws_docs',
        name: 'Product docs',
        slug: 'product-docs',
        description: 'Guides, API references, and release notes.',
        color: 'teal',
        status: 'active',
        members: [
            { id: 'u_grace', name: 'Grace Hopper', email: 'grace@ortha.dev' }
        ]
    }
];

/**
 * Stub `GET /api/workspaces` (the list the grid reads via `useWorkspaces`).
 * The admin client maps this server view to its `Workspace` shape, deriving
 * member initials/colors on the client. Scoped to the test's `page`, so it
 * resets with the browser context — the FE analog of `resetDb()`.
 *
 * Only the list `GET` is fulfilled; other methods fall through.
 */
export async function mockWorkspaces(
    page: Page,
    workspaces: WorkspaceView[] = DEFAULT_WORKSPACES
): Promise<void> {
    await page.route('**/api/workspaces', async (route) => {
        if (route.request().method() !== 'GET') {
            await route.fallback();
            return;
        }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(workspaces)
        });
    });
}
