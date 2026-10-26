import { type Page, type Route } from '@playwright/test';

/** A member's role as `GET /api/users` returns it (server `MemberRoleView`). */
interface RoleSeed {
    id: string;
    key: string;
    name: string;
}

/**
 * A member's workspace as the API returns it (server `MemberWorkspaceView`).
 *
 * `description` is on the wire and **required** — `memberMapper` reads
 * `dto.description` and `WorkspaceMembershipRow` renders it behind a
 * truthiness check. It was missing here, so every suite saw `undefined`, the
 * card's description line never rendered, and nothing in the repo would have
 * noticed the server dropping the field. `null` is the real "none" value, not
 * an absent key.
 */
interface WorkspaceSeed {
    id: string;
    name: string;
    description: string | null;
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
    /**
     * The newest session use (ISO), or `null` for someone who never signed
     * in. Optional so a suite's ad-hoc seed can leave it out — the admin reads
     * a missing value as "never".
     */
    lastActiveAt?: string | null;
}

const TIMESTAMP = '2026-01-01T00:00:00.000Z';

/**
 * A timestamp `minutesAgo` before now. "Last active" is read relative to the
 * browser's clock, so a seed that wants "12 min ago" on screen has to be
 * relative too.
 *
 * A seed reads it through a **getter**, not a value. A value is computed
 * once, when the worker imports this file, and a worker lives for the whole
 * run. Twenty minutes in, "12 min ago" read "26 min ago" and the Members
 * suite failed only in full runs.
 */
export function minutesAgo(minutes: number): string {
    return new Date(Date.now() - minutes * 60_000).toISOString();
}

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
        email: 'ada@orthacms.dev',
        name: 'Ada Lovelace',
        role: ROLES.admin,
        status: 'active',
        createdAt: TIMESTAMP,
        isLastAdmin: true,
        get lastActiveAt() {
            return minutesAgo(12);
        },
        // One described and one not, so the card's two branches are both
        // reachable from the default seed rather than only the empty one.
        workspaces: [
            {
                id: 'ws_marketing',
                name: 'Marketing site',
                description:
                    'Landing pages, the blog, and campaign content for the public website.',
                color: 'violet'
            },
            {
                id: 'ws_internal',
                name: 'Internal wiki',
                description: null,
                color: 'amber'
            }
        ]
    },
    {
        id: 'u_grace',
        email: 'grace@orthacms.dev',
        name: 'Grace Hopper',
        role: ROLES.contributor,
        status: 'active',
        createdAt: TIMESTAMP,
        isLastAdmin: false,
        get lastActiveAt() {
            return minutesAgo(60);
        },
        workspaces: [
            {
                id: 'ws_docs',
                name: 'Product docs',
                description:
                    'Guides, API references, and release notes for the developer portal.',
                color: 'teal'
            }
        ]
    },
    {
        id: 'u_alan',
        email: 'alan@orthacms.dev',
        name: null,
        role: ROLES.viewer,
        status: 'pending',
        createdAt: TIMESTAMP,
        isLastAdmin: false,
        workspaces: [],
        lastActiveAt: null
    },
    {
        id: 'u_katherine',
        email: 'katherine@orthacms.dev',
        name: 'Katherine Johnson',
        role: ROLES.viewer,
        status: 'disabled',
        createdAt: TIMESTAMP,
        isLastAdmin: false,
        workspaces: [],
        lastActiveAt: '2025-09-30T12:00:00.000Z'
    }
];

/** Generates `count` active viewer members — for pagination tests. */
export function manyMembers(count: number): MemberSeed[] {
    return Array.from({ length: count }, (_, index) => ({
        id: `u_gen_${index}`,
        email: `gen-${index}@orthacms.dev`,
        name: `Generated ${String(index).padStart(2, '0')}`,
        role: ROLES.viewer,
        status: 'active' as const,
        createdAt: TIMESTAMP,
        isLastAdmin: false,
        workspaces: []
    }));
}

/** Reads the list query's parameters from the intercepted request URL. */
function paramsOf(route: Route): {
    search: string;
    filter: string;
    status: string;
    role: string;
    page: number;
    pageSize: number;
} {
    const url = new URL(route.request().url());
    return {
        search: (url.searchParams.get('search') ?? '').trim().toLowerCase(),
        filter: url.searchParams.get('filter') ?? '',
        status: url.searchParams.get('status') ?? '',
        role: url.searchParams.get('role') ?? '',
        page: Number(url.searchParams.get('page') ?? '1'),
        pageSize: Number(url.searchParams.get('pageSize') ?? '10')
    };
}

/**
 * The directory-wide head counts the server returns beside every page —
 * computed over the **whole** roster, never the filtered page, exactly as the
 * server does.
 */
export function countsOf(members: MemberSeed[]) {
    return {
        everyone: members.length,
        active: members.filter((m) => m.status === 'active').length,
        admins: members.filter((m) => m.role.key === 'admin').length,
        invited: members.filter((m) => m.status === 'pending').length,
        disabled: members.filter((m) => m.status === 'disabled').length
    };
}

/** The leaf/group wire shapes the query builder emits under `?filter=`. */
type FilterNode =
    | { and: FilterNode[] }
    | { or: FilterNode[] }
    | { field: string; op: string; value: unknown };

/** Resolve a member's value for a wire field name (incl. the `role.key` path). */
function memberValue(member: MemberSeed, field: string): string {
    if (field === 'role.key') return member.role.key;
    if (field === 'email') return member.email;
    if (field === 'name') return member.name ?? '';
    if (field === 'status') return member.status;
    return '';
}

/**
 * A minimal evaluator for the query-builder wire tree — enough to make the
 * Members filter drawer behave for real in a browser test. Supports the
 * scalar ops the simple-field UI can produce (`eq`/`ne`/`ilike`/`in`/`null`)
 * plus `and`/`or` groups; an unknown shape matches everything (fail-open, so a
 * test that doesn't exercise filtering is unaffected).
 */
function matchesNode(member: MemberSeed, node: FilterNode): boolean {
    if ('and' in node) return node.and.every((c) => matchesNode(member, c));
    if ('or' in node) return node.or.some((c) => matchesNode(member, c));
    const actual = memberValue(member, node.field);
    switch (node.op) {
        case 'eq':
            return actual === node.value;
        case 'ne':
            return actual !== node.value;
        case 'in':
            return Array.isArray(node.value) && node.value.includes(actual);
        case 'ilike': {
            const needle = String(node.value)
                .replace(/^%|%$/g, '')
                .toLowerCase();
            return actual.toLowerCase().includes(needle);
        }
        case 'null':
            return actual.length === 0;
        default:
            return true;
    }
}

/** Apply a raw `?filter=` JSON string to the roster; no filter → unchanged. */
function applyFilter(members: MemberSeed[], filter: string): MemberSeed[] {
    if (!filter) return members;
    let node: FilterNode;
    try {
        node = JSON.parse(filter) as FilterNode;
    } catch {
        return members;
    }
    return members.filter((m) => matchesNode(m, node));
}

/** Handle returned by {@link mockMembers} for asserting the read fired — or didn't. */
export interface MembersMock {
    /** How many `GET /api/users` requests this route answered. */
    readonly count: number;
}

/**
 * Stub `GET /api/users` with a deterministic roster, applying the same
 * search + pagination the server does so the page's controls behave for real.
 * The Members page sits behind the shell's gate, so a test also needs
 * `mockSignedIn` for the auth probe.
 *
 * Registered per-`page`, so it resets between tests with the browser context.
 * Pass `delayMs` to hold the response open, so a test can observe the table's
 * loading skeleton before the rows land, or `status` for a roster the API
 * cannot serve — the page's error branch is otherwise unreachable. A `5xx` is
 * retried three times with backoff by the shared query client, so an assertion
 * on the resulting alert needs a generous timeout.
 *
 * The returned counter is what proves a read did **not** happen: the query is
 * gated behind an `enabled` flag, and "no rows on screen" cannot tell a
 * suppressed request apart from an empty answer.
 */
export async function mockMembers(
    page: Page,
    members: MemberSeed[] = DEFAULT_MEMBERS,
    { delayMs, status = 200 }: { delayMs?: number; status?: number } = {}
): Promise<MembersMock> {
    let count = 0;
    await page.route('**/api/users?*', async (route) => {
        if (route.request().method() !== 'GET') {
            await route.fallback();
            return;
        }
        count += 1;
        if (delayMs) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        if (status !== 200) {
            await route.fulfill({
                status,
                contentType: 'application/json',
                body: JSON.stringify({
                    statusCode: status,
                    message: 'Internal Server Error'
                })
            });
            return;
        }
        const {
            search,
            filter,
            status: statusParam,
            role,
            page: pageNum,
            pageSize
        } = paramsOf(route);
        const searched = members.filter(
            (m) =>
                (!search ||
                    (m.name ?? '').toLowerCase().includes(search) ||
                    m.email.toLowerCase().includes(search)) &&
                (!statusParam || m.status === statusParam) &&
                (!role || m.role.key === role)
        );
        // The query-builder `?filter=` intersects with `search`, `status` and
        // `role`, mirroring the server's AND composition.
        const matched = applyFilter(searched, filter);
        const start = (pageNum - 1) * pageSize;
        const items = matched.slice(start, start + pageSize);

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                items,
                total: matched.length,
                page: pageNum,
                pageSize,
                counts: countsOf(members)
            })
        });
    });
    return {
        get count() {
            return count;
        }
    };
}

/**
 * The raw invite token the mocked mint endpoints hand back. The real server
 * returns it exactly once (it stores only the hash), which is what the admin's
 * reveal-once link panel exists for.
 */
export const INVITE_TOKEN = 'tok_invite_abc123';

/** The token a resend rotates to — deliberately different, as rotation implies. */
export const ROTATED_INVITE_TOKEN = 'tok_invite_rotated456';

/**
 * Stub `POST /api/users/invites`, echoing back a new pending member plus the
 * one-time `inviteToken`, and recording each call so a test can assert the
 * invite was (not) sent.
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
                workspaces: [],
                inviteToken: INVITE_TOKEN
            })
        });
    });
    return {
        get count() {
            return count;
        }
    };
}

/**
 * Stub `POST /api/users/:id/invites/resend`, echoing the member back with a
 * **rotated** token and recording each call. Rotation kills whatever link the
 * invitee already held, so the admin UI has to surface the new one — this mock
 * is what lets a test assert that it does.
 */
export async function spyResendInvite(
    page: Page,
    member: MemberSeed
): Promise<{ readonly count: number }> {
    let count = 0;
    await page.route('**/api/users/*/invites/resend', async (route) => {
        count += 1;
        await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
                ...member,
                inviteToken: ROTATED_INVITE_TOKEN
            })
        });
    });
    return {
        get count() {
            return count;
        }
    };
}

/**
 * Stub `DELETE /api/users/:id/invites` and count the calls. Revoking **deletes
 * the pending account** server-side, so the count is what a test asserts to
 * prove a cancelled confirmation sent nothing.
 */
export async function spyRevokeInvite(
    page: Page,
    roster?: MemberSeed[]
): Promise<{ readonly count: number }> {
    let count = 0;
    await page.route('**/api/users/*/invites', async (route) => {
        if (route.request().method() !== 'DELETE') {
            await route.fallback();
            return;
        }
        count += 1;
        // Pass the same array `mockMembers` was seeded with to make the deletion
        // stick: the roster refetches straight after, so without this the row
        // reappears and a test can't observe the list actually shrinking.
        if (roster) {
            const id = new URL(route.request().url()).pathname
                .split('/')
                .at(-2);
            const index = roster.findIndex((member) => member.id === id);
            if (index !== -1) {
                roster.splice(index, 1);
            }
        }
        await route.fulfill({ status: 204, body: '' });
    });
    return {
        get count() {
            return count;
        }
    };
}

/**
 * Stub `POST /api/users/:id/disable` and `/enable`, echoing the member back
 * with the new status and counting each call.
 *
 * Pass `status` for a write the server refuses. The call still counts — the
 * request was made, it just failed — which is what lets a test tell the
 * mutation's `onError` path (a toast, a closed dialog, focus put back) apart
 * from a click that never reached the network at all.
 */
export async function spySetMemberStatus(
    page: Page,
    member: MemberSeed,
    // 201, not 200: neither controller carries an `@HttpCode`, so Nest answers
    // a `@Post` with `Created`. Nothing in the admin branches on which 2xx it
    // is, so this is a truthfulness fix rather than a bug fix — but a seed that
    // states the wrong status is the same class of claim as one that states the
    // wrong body, and this one was never checked against a server until now.
    { status = 201 }: { status?: number } = {}
): Promise<{ readonly disabled: number; readonly enabled: number }> {
    let disabled = 0;
    let enabled = 0;
    /** The body for whichever direction was asked for — or the refusal. */
    const answer = (next: 'disabled' | 'active') =>
        status < 400
            ? JSON.stringify({ ...member, status: next })
            : JSON.stringify({
                  statusCode: status,
                  message: 'Internal Server Error'
              });
    await page.route('**/api/users/*/disable', async (route) => {
        disabled += 1;
        await route.fulfill({
            status,
            contentType: 'application/json',
            body: answer('disabled')
        });
    });
    await page.route('**/api/users/*/enable', async (route) => {
        enabled += 1;
        await route.fulfill({
            status,
            contentType: 'application/json',
            body: answer('active')
        });
    });
    return {
        get disabled() {
            return disabled;
        },
        get enabled() {
            return enabled;
        }
    };
}

/** What {@link spyInviteMany} recorded. */
export interface InviteManySpy {
    /** How many `POST /api/users/invites/batch` requests were answered. */
    readonly count: number;
    /** The bodies posted, in order. */
    readonly bodies: {
        emails: string[];
        role: string;
        workspaceIds?: string[];
    }[];
}

/**
 * Stub `POST /api/users/invites/batch` — the invite page's submit. Echoes one
 * pending member per address, each with its own one-time token
 * (`tok_<local part>`) and an expiry seven days out, unless `mailed` is set:
 * then, like a server with a mail provider, no token comes back at all.
 *
 * Pass `taken` to answer the way the server does when some of the addresses
 * already belong to members — an all-or-nothing `409 EMAIL_TAKEN` naming every
 * one of them, with nobody invited. `delayMs` holds the request open so a test
 * can observe the pending button.
 */
export async function spyInviteMany(
    page: Page,
    {
        taken = [],
        mailed = false,
        status = 201,
        delayMs
    }: {
        taken?: string[];
        mailed?: boolean;
        status?: number;
        delayMs?: number;
    } = {}
): Promise<InviteManySpy> {
    let count = 0;
    const bodies: InviteManySpy['bodies'] = [];
    await page.route('**/api/users/invites/batch', async (route) => {
        if (route.request().method() !== 'POST') {
            await route.fallback();
            return;
        }
        count += 1;
        const body = JSON.parse(route.request().postData() ?? '{}');
        bodies.push(body);
        if (delayMs) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        const collisions = (body.emails as string[]).filter((email) =>
            taken.includes(email)
        );
        if (collisions.length > 0) {
            await route.fulfill({
                status: 409,
                contentType: 'application/json',
                body: JSON.stringify({
                    statusCode: 409,
                    error: 'Conflict',
                    message:
                        'Some of these addresses already belong to members',
                    code: 'EMAIL_TAKEN',
                    emails: collisions
                })
            });
            return;
        }
        if (status >= 400) {
            await route.fulfill({
                status,
                contentType: 'application/json',
                body: JSON.stringify({ statusCode: status, message: 'Nope' })
            });
            return;
        }
        const expires = new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString();
        await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
                items: (body.emails as string[]).map((email, index) => ({
                    id: `u_new_${index}`,
                    email,
                    name: null,
                    role: ROLES[body.role] ?? ROLES.viewer,
                    status: 'pending',
                    createdAt: new Date().toISOString(),
                    isLastAdmin: false,
                    workspaces: [],
                    lastActiveAt: null,
                    inviteExpiresAt: expires,
                    ...(mailed
                        ? {}
                        : { inviteToken: `tok_${email.split('@')[0]}` })
                }))
            })
        });
    });
    return {
        get count() {
            return count;
        },
        get bodies() {
            return bodies;
        }
    };
}
