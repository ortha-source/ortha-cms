import { type Page } from '@playwright/test';

/** A member as `GET /api/workspaces` returns it (the server's `WorkspaceMemberView`). */
interface MemberSeed {
    id: string;
    name: string | null;
    email: string;
}

/** A workspace as `GET /api/workspaces` returns it (the server's `WorkspaceView`). */
interface WorkspaceSeed {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    color: string;
    createdAt: string;
    updatedAt: string;
    members: MemberSeed[];
}

const TIMESTAMP = '2026-01-01T00:00:00.000Z';

const member = (id: string, name: string | null, email: string): MemberSeed => ({
    id,
    name,
    email
});

/**
 * The fixed workspaces `GET /api/workspaces` returns — the front-end analog of
 * the server suite's seed. Four workspaces (the API has no `status`, so the grid
 * reads them all as Active); "Product docs" has five members so the member-stack
 * collapses to a "+1" pill, and "Marketing site" carries Ada Lovelace for the
 * member-popover assertions.
 */
const DEFAULT_WORKSPACES: WorkspaceSeed[] = [
    {
        id: 'ws_marketing',
        name: 'Marketing site',
        slug: 'marketing-site',
        description:
            'Landing pages, the blog, and campaign content for the public website.',
        color: 'violet',
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
        members: [
            member('u_ada', 'Ada Lovelace', 'ada@ortha.dev'),
            member('u_grace', 'Grace Hopper', 'grace@ortha.dev'),
            member('u_alan', 'Alan Turing', 'alan@ortha.dev')
        ]
    },
    {
        id: 'ws_docs',
        name: 'Product docs',
        slug: 'product-docs',
        description:
            'Guides, API references, and release notes for the developer portal.',
        color: 'teal',
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
        members: [
            member('u_grace', 'Grace Hopper', 'grace@ortha.dev'),
            member('u_linus', 'Linus Torvalds', 'linus@ortha.dev'),
            member('u_margaret', 'Margaret Hamilton', 'margaret@ortha.dev'),
            member('u_dennis', 'Dennis Ritchie', 'dennis@ortha.dev'),
            member('u_katherine', 'Katherine Johnson', 'katherine@ortha.dev')
        ]
    },
    {
        id: 'ws_support',
        name: 'Support hub',
        slug: 'support-hub',
        description:
            'Help-center articles and canned responses shared across the support team.',
        color: 'green',
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
        members: [
            member('u_margaret', 'Margaret Hamilton', 'margaret@ortha.dev'),
            member('u_alan', 'Alan Turing', 'alan@ortha.dev')
        ]
    },
    {
        id: 'ws_internal',
        name: 'Internal wiki',
        slug: 'internal-wiki',
        description:
            'Team handbook, onboarding, and process docs for employees only.',
        color: 'amber',
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
        members: [
            member('u_ada', 'Ada Lovelace', 'ada@ortha.dev'),
            member('u_dennis', 'Dennis Ritchie', 'dennis@ortha.dev')
        ]
    }
];

/**
 * Stub `GET /api/workspaces` with a deterministic roster — the front-end analog
 * of the server suite's seeding. The Workspaces page sits behind the shell's
 * gate, so a test also needs `mockSignedIn` for the auth probe.
 *
 * Registered per-`page`, so it resets between tests with the browser context.
 */
export async function mockWorkspaces(
    page: Page,
    workspaces: WorkspaceSeed[] = DEFAULT_WORKSPACES
): Promise<void> {
    await page.route('**/api/workspaces', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(workspaces)
        });
    });
}
