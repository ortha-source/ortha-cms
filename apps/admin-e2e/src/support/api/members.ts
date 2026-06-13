import { type Page, type Route } from '@playwright/test';

/** A member's role as `GET /api/users` returns it (server `MemberRoleView`). */
interface RoleSeed {
    id: string;
    key: string;
    name: string;
}

/** A member's workspace as the API returns it (server `MemberWorkspaceView`). */
interface WorkspaceSeed {
    id: string;
    name: string;
    color: string;
}

/** A member as `GET /api/users` returns it (the server's `MemberView`). */
export interface MemberSeed {
    id: string;
    email: string;
    name: string | null;
    role: RoleSeed;
    status: 'pending' | 'active' | 'disabled';
    createdAt: string;
    isLastAdmin: boolean;
    workspaces: WorkspaceSeed[];
}

const TIMESTAMP = '2026-01-01T00:00:00.000Z';

const ROLES: Record<string, RoleSeed> = {
    admin: { id: 'role_admin', key: 'admin', name: 'Administrator' },
    contributor: {
        id: 'role_contributor',
        key: 'contributor',
        name: 'Contributor'
    },
    viewer: { id: 'role_viewer', key: 'viewer', name: 'Viewer' }
};

/**
 * The fixed roster `GET /api/users` returns — the front-end analog of the
 * server suite's seed. Ada is the sole active admin (so her controls lock),
 * Grace is an active contributor, Alan is a pending invite, and Katherine is a
 * disabled viewer — one of every status the table renders.
 */
export const DEFAULT_MEMBERS: MemberSeed[] = [
    {
        id: 'u_ada',
        email: 'ada@ortha.dev',
        name: 'Ada Lovelace',
        role: ROLES.admin,
        status: 'active',
        createdAt: TIMESTAMP,
        isLastAdmin: true,
        workspaces: [
            { id: 'ws_marketing', name: 'Marketing site', color: 'violet' },
            { id: 'ws_internal', name: 'Internal wiki', color: 'amber' }
        ]
    },
    {
        id: 'u_grace',
        email: 'grace@ortha.dev',
        name: 'Grace Hopper',
        role: ROLES.contributor,
        status: 'active',
        createdAt: TIMESTAMP,
        isLastAdmin: false,
        workspaces: [{ id: 'ws_docs', name: 'Product docs', color: 'teal' }]
    },
    {
        id: 'u_alan',
        email: 'alan@ortha.dev',
        name: null,
        role: ROLES.viewer,
        status: 'pending',
        createdAt: TIMESTAMP,
        isLastAdmin: false,
        workspaces: []
    },
    {
        id: 'u_katherine',
        email: 'katherine@ortha.dev',
        name: 'Katherine Johnson',
        role: ROLES.viewer,
        status: 'disabled',
        createdAt: TIMESTAMP,
        isLastAdmin: false,
        workspaces: []
    }
];

/** Generates `count` active viewer members — for pagination tests. */
export function manyMembers(count: number): MemberSeed[] {
    return Array.from({ length: count }, (_, index) => ({
        id: `u_gen_${index}`,
        email: `gen-${index}@ortha.dev`,
        name: `Generated ${String(index).padStart(2, '0')}`,
        role: ROLES.viewer,
        status: 'active' as const,
        createdAt: TIMESTAMP,
        isLastAdmin: false,
        workspaces: []
    }));
}

/** Reads `search`/`page`/`pageSize` from the intercepted request URL. */
function paramsOf(route: Route): {
    search: string;
    page: number;
    pageSize: number;
} {
    const url = new URL(route.request().url());
    return {
        search: (url.searchParams.get('search') ?? '').trim().toLowerCase(),
        page: Number(url.searchParams.get('page') ?? '1'),
        pageSize: Number(url.searchParams.get('pageSize') ?? '10')
    };
}

/**
 * Stub `GET /api/users` with a deterministic roster, applying the same
 * search + pagination the server does so the page's controls behave for real.
 * The Members page sits behind the shell's gate, so a test also needs
 * `mockSignedIn` for the auth probe.
 *
 * Registered per-`page`, so it resets between tests with the browser context.
 */
export async function mockMembers(
    page: Page,
    members: MemberSeed[] = DEFAULT_MEMBERS
): Promise<void> {
    await page.route('**/api/users?*', async (route) => {
        if (route.request().method() !== 'GET') {
            await route.fallback();
            return;
        }
        const { search, page: pageNum, pageSize } = paramsOf(route);
        const matched = search
            ? members.filter(
                  (m) =>
                      (m.name ?? '').toLowerCase().includes(search) ||
                      m.email.toLowerCase().includes(search)
              )
            : members;
        const start = (pageNum - 1) * pageSize;
        const items = matched.slice(start, start + pageSize);

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                items,
                total: matched.length,
                page: pageNum,
                pageSize
            })
        });
    });
}

/**
 * Stub `POST /api/users/invites`, echoing back a new pending member and
 * recording each call so a test can assert the invite was (not) sent.
 */
export async function spyInvite(
    page: Page
): Promise<{ readonly count: number }> {
    let count = 0;
    await page.route('**/api/users/invites', async (route) => {
        count += 1;
        const body = JSON.parse(route.request().postData() ?? '{}');
        await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
                id: 'u_new',
                email: body.email,
                name: body.name ?? null,
                role: ROLES[body.role] ?? ROLES.viewer,
                status: 'pending',
                createdAt: TIMESTAMP,
                isLastAdmin: false,
                workspaces: []
            })
        });
    });
    return {
        get count() {
            return count;
        }
    };
}
