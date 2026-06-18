import { type Page } from '@playwright/test';
import { DEFAULT_MEMBERS, type MemberSeed } from './members';

/** A session as `GET /api/users/:id/sessions` returns it. */
export interface SessionSeed {
    id: string;
    userAgent: string | null;
    ipAddress: string | null;
    createdAt: string;
    lastUsedAt: string;
    expiresAt: string;
    current: boolean;
}

const TIMESTAMP = '2026-01-01T00:00:00.000Z';
const EXPIRES = '2026-12-31T00:00:00.000Z';

/** Two live sessions for the detail page's Sessions tab. */
export const DEFAULT_SESSIONS: SessionSeed[] = [
    {
        id: 'sess_a',
        userAgent: 'Chrome on macOS',
        ipAddress: '203.0.113.4',
        createdAt: TIMESTAMP,
        lastUsedAt: TIMESTAMP,
        expiresAt: EXPIRES,
        current: false
    },
    {
        id: 'sess_b',
        userAgent: 'Firefox on Linux',
        ipAddress: '198.51.100.9',
        createdAt: TIMESTAMP,
        lastUsedAt: TIMESTAMP,
        expiresAt: EXPIRES,
        current: false
    }
];

/**
 * Stub `GET /api/users/:id` with a member from the shared roster (so the detail
 * page and the list agree). 404s an unknown id, mirroring the server. Pair with
 * `mockMembers` + `mockSignedIn` like the list suites.
 */
export async function mockUserDetail(
    page: Page,
    members: MemberSeed[] = DEFAULT_MEMBERS
): Promise<void> {
    await page.route('**/api/users/*', async (route) => {
        const url = new URL(route.request().url());
        // Only handle the bare `/api/users/:id` GET — let sub-resources
        // (`/sessions`) and the `?...` list fall through to their own routes.
        if (
            route.request().method() !== 'GET' ||
            /\/sessions(\/|$)/.test(url.pathname)
        ) {
            await route.fallback();
            return;
        }
        const id = url.pathname.split('/').pop();
        const member = members.find((m) => m.id === id);
        await route.fulfill({
            status: member ? 200 : 404,
            contentType: 'application/json',
            body: JSON.stringify(member ?? { message: 'Not found' })
        });
    });
}

/** Stub `GET /api/users/:id/sessions` and record `DELETE` revocations. */
export async function mockUserSessions(
    page: Page,
    sessions: SessionSeed[] = DEFAULT_SESSIONS
): Promise<{ readonly revoked: string[] }> {
    const revoked: string[] = [];
    await page.route('**/api/users/*/sessions', async (route) => {
        if (route.request().method() !== 'GET') {
            await route.fallback();
            return;
        }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(sessions.filter((s) => !revoked.includes(s.id)))
        });
    });
    await page.route('**/api/users/*/sessions/*', async (route) => {
        if (route.request().method() !== 'DELETE') {
            await route.fallback();
            return;
        }
        const id = new URL(route.request().url()).pathname.split('/').pop();
        if (id) {
            revoked.push(id);
        }
        await route.fulfill({ status: 204, body: '' });
    });
    return {
        get revoked() {
            return revoked;
        }
    };
}

/** Stub `GET /api/activity` as empty (the Activity tab's data source). */
export async function mockEmptyActivity(page: Page): Promise<void> {
    await page.route('**/api/activity?*', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                items: [],
                total: 0,
                page: 1,
                pageSize: 25
            })
        });
    });
}

/** An audit event as `GET /api/activity` returns it. */
export interface ActivitySeed {
    id: string;
    kind: string;
    subjectType: string;
    subjectId: string;
    actorId: string | null;
    actorEmail: string | null;
    meta: Record<string, unknown> | null;
    at: string;
}

/**
 * Stub `GET /api/activity` with seeded events for the Activity tab. The Activity
 * tab pins a `subjectId` filter, but the mock returns the events as-is (the
 * filtering is the server's job and is covered there) so the tab's rendering —
 * the per-action labels and tinted icons — can be asserted.
 */
export async function mockActivity(
    page: Page,
    events: ActivitySeed[]
): Promise<void> {
    await page.route('**/api/activity?*', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                items: events,
                total: events.length,
                page: 1,
                pageSize: 25
            })
        });
    });
}

/** Spy on `PATCH /api/users/:id`, echoing back the merged member. */
export async function spyUpdateMember(
    page: Page,
    members: MemberSeed[] = DEFAULT_MEMBERS
): Promise<{ readonly bodies: Record<string, unknown>[] }> {
    const bodies: Record<string, unknown>[] = [];
    await page.route('**/api/users/*', async (route) => {
        if (route.request().method() !== 'PATCH') {
            await route.fallback();
            return;
        }
        const id = new URL(route.request().url()).pathname.split('/').pop();
        const body = JSON.parse(route.request().postData() ?? '{}');
        bodies.push(body);
        const base = members.find((m) => m.id === id) ?? members[0];
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ...base, ...body })
        });
    });
    return {
        get bodies() {
            return bodies;
        }
    };
}
