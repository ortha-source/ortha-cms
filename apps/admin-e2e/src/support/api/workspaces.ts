import { type Page } from '@playwright/test';

/** A member as the server's workspace endpoints return it. */
interface WorkspaceMemberView {
    id: string;
    name: string | null;
    email: string;
}

/** A workspace as the server's workspace endpoints return it. */
interface WorkspaceView {
    id: string;
    name: string;
    slug: string;
    description: string;
    color: string;
    status: 'active' | 'archived';
    members: WorkspaceMemberView[];
}

const member = (
    id: string,
    name: string,
    email: string
): WorkspaceMemberView => ({ id, name, email });

/**
 * The default seed the suites assert against: four Active workspaces (Marketing
 * site, Product docs, Support hub, Internal wiki) and two Archived (Research
 * archive, Events 2023); Product docs has five members. Mirrors the shape the
 * real `GET /api/workspaces` returns.
 */
export const WORKSPACES_SEED: WorkspaceView[] = [
    {
        id: 'ws_marketing',
        name: 'Marketing site',
        slug: 'marketing-site',
        description:
            'Landing pages, the blog, and campaign content for the public website.',
        color: 'violet',
        status: 'active',
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
        status: 'active',
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
        status: 'active',
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
        status: 'active',
        members: [
            member('u_ada', 'Ada Lovelace', 'ada@ortha.dev'),
            member('u_dennis', 'Dennis Ritchie', 'dennis@ortha.dev'),
            member('u_grace', 'Grace Hopper', 'grace@ortha.dev'),
            member('u_katherine', 'Katherine Johnson', 'katherine@ortha.dev')
        ]
    },
    {
        id: 'ws_research',
        name: 'Research archive',
        slug: 'research-archive',
        description:
            'Retired experiments and old design explorations kept for reference.',
        color: 'slate',
        status: 'archived',
        members: [member('u_alan', 'Alan Turing', 'alan@ortha.dev')]
    },
    {
        id: 'ws_events',
        name: 'Events 2023',
        slug: 'events-2023',
        description:
            'Last year’s conference microsites and event landing pages, now archived.',
        color: 'rose',
        status: 'archived',
        members: [
            member('u_katherine', 'Katherine Johnson', 'katherine@ortha.dev'),
            member('u_linus', 'Linus Torvalds', 'linus@ortha.dev')
        ]
    }
];

/** The owner the mocked session attributes a created workspace to. */
const OWNER = member(
    '00000000-0000-0000-0000-000000000001',
    'Admin User',
    'admin@example.com'
);

const CONTENT_TYPES = [
    { name: 'blog_post', kind: 'collection', label: 'Blog posts' },
    { name: 'product', kind: 'collection', label: 'Products' },
    { name: 'home', kind: 'single', label: 'Home', path: '/' },
    { name: 'about', kind: 'single', label: 'About', path: '/about' }
];

const DIRECTORY: WorkspaceMemberView[] = [
    member('u_barbara', 'Barbara Liskov', 'barbara@ortha.dev'),
    member('u_edsger', 'Edsger Dijkstra', 'edsger@ortha.dev'),
    member('u_donald', 'Donald Knuth', 'donald@ortha.dev')
];

const json = (body: unknown) => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body)
});

/**
 * Stub `GET /api/workspaces` (the list the grid reads via `useWorkspaces`). The
 * admin client maps this view to its `Workspace` shape, deriving member
 * initials/colors on the client. Scoped to the test's `page`, so it resets with
 * the browser context — the FE analog of `resetDb()`. Only the list `GET` is
 * fulfilled; other methods fall through.
 */
export async function mockWorkspaces(
    page: Page,
    workspaces: WorkspaceView[] = WORKSPACES_SEED
): Promise<void> {
    await page.route('**/api/workspaces', async (route) => {
        if (route.request().method() !== 'GET') {
            await route.fallback();
            return;
        }
        await route.fulfill(json(workspaces));
    });
}

/**
 * Stub the full create-workspace flow with a **stateful** in-memory store: the
 * list `GET` reflects whatever `POST /api/workspaces` has created, so a created
 * card survives the post-create refetch (not just the optimistic insert). Also
 * stubs the wizard's supporting reads — slug availability, the member directory,
 * and the content-type catalogue. The owner is attributed from the mocked
 * session, mirroring the server deriving it from the cookie.
 */
export async function mockWorkspacesApi(
    page: Page,
    initial: WorkspaceView[] = WORKSPACES_SEED
): Promise<void> {
    const store = initial.map((w) => ({ ...w }));

    await page.route(/\/api\/workspaces(\?.*)?$/, async (route) => {
        const request = route.request();
        if (request.method() === 'GET') {
            await route.fulfill(json(store));
            return;
        }
        if (request.method() === 'POST') {
            const body = request.postDataJSON() as {
                name: string;
                slug: string;
                description: string;
                color: string;
                members: { id: string; name: string; email: string }[];
            };
            const created: WorkspaceView = {
                id: `ws_${body.slug}`,
                name: body.name,
                slug: body.slug,
                description: body.description,
                color: body.color,
                status: 'active',
                members: [
                    OWNER,
                    ...body.members.map((m) => member(m.id, m.name, m.email))
                ]
            };
            store.unshift(created);
            await route.fulfill({ ...json(created), status: 201 });
            return;
        }
        await route.fallback();
    });

    // Anchored RegExps (not globs): a glob like `**/api/users**` also matches
    // the Vite source module `.../lib/api/usersClient/index.ts`, breaking the
    // wizard's lazy import. These match only the real endpoint paths.
    await page.route(
        /\/api\/workspaces\/slug-available(\?.*)?$/,
        async (route) => {
            const slug = new URL(route.request().url()).searchParams.get(
                'slug'
            );
            const available = !store.some((w) => w.slug === slug);
            await route.fulfill(json({ available }));
        }
    );

    await page.route(/\/api\/users(\?.*)?$/, async (route) => {
        const q = (
            new URL(route.request().url()).searchParams.get('q') ?? ''
        ).toLowerCase();
        const matches = q
            ? DIRECTORY.filter(
                  (u) =>
                      u.name?.toLowerCase().includes(q) ||
                      u.email.toLowerCase().includes(q)
              )
            : DIRECTORY;
        await route.fulfill(json(matches));
    });

    await page.route(/\/api\/content-types(\?.*)?$/, async (route) => {
        await route.fulfill(json(CONTENT_TYPES));
    });
}
