import { type Page } from '@playwright/test';

interface LoginOutcome {
    /** Response status: 201 = success (app navigates to `/`), 401 = bad creds. */
    status?: number;
    /** Hold the response open this long, to observe the pending/spinner state. */
    delayMs?: number;
}

/**
 * Stub `POST /api/auth/login`. This is the front-end analog of the server
 * suite's `seedActiveUser`: instead of a DB row, it fixes what the API would
 * answer, so the test is deterministic and needs no real backend.
 *
 * Routes are scoped to the test's `page`, so they reset between tests with the
 * browser context — the e2e equivalent of `resetDb()`.
 */
export async function mockLogin(
    page: Page,
    { status = 201, delayMs }: LoginOutcome = {}
): Promise<void> {
    await page.route('**/api/auth/login', async (route) => {
        if (delayMs) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        await route.fulfill({
            status,
            contentType: 'application/json',
            body: JSON.stringify(
                status === 201
                    ? { ok: true }
                    : { message: 'Invalid credentials' }
            )
        });
    });
}

/** The full v1 permission catalogue — what the admin role grants. */
const ALL_PERMISSIONS = [
    'workspaces:create',
    'workspaces:read',
    'workspaces:update',
    'workspaces:delete',
    'users:read',
    'users:create',
    'users:update',
    'users:delete',
    'activity:read',
    'content:read',
    'content:create',
    'content:update',
    'content:publish',
    'content:delete',
    'media:read',
    'media:create',
    'media:update',
    'media:delete',
    // Without this the copilot renders nothing at all — no sidebar switcher, no
    // dock, and the Agents view answers "No access". It was missing, so every
    // suite claiming "an admin holding every permission" was quietly blind to
    // that whole surface.
    'copilot:use',
    // Admin-only: authoring a skill writes prompt text that runs for everyone in
    // the workspace (ADR-0010). Narrow this away to assert the rail's skills
    // link is absent for a contributor.
    'copilot:skills:manage'
];

/**
 * The authenticated user `GET /api/auth/me` returns (the server's `PublicUser`
 * plus the role's `permissions`). Defaults to an admin holding every permission,
 * so signed-in suites see all permission-gated UI; override `permissions` to
 * test a restricted role (e.g. a viewer without `workspaces:create`).
 */
const DEFAULT_USER = {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@example.com',
    name: 'Admin User',
    roleId: '00000000-0000-0000-0000-0000000000a1',
    status: 'active',
    // Defaults to a full-access admin; a suite narrows this via `mockSignedIn`
    // to exercise permission-gated UI.
    permissions: ALL_PERMISSIONS
};

/**
 * Stub `GET /api/auth/me` as **signed in**. The host's `AuthProvider` calls this
 * on load to resolve the current user, so any test that lands on a private route
 * (the home page) must seed a session here — the FE analog of `seedActiveUser`.
 *
 * Registered per-`page`; later registrations win, so a test can start signed out
 * (e.g. in `beforeEach`) and flip to signed in before submitting the login form.
 *
 * Pass `delayMs` to hold the probe open — the gate stays in its `Loading` state,
 * so a test can observe the branded root loader (`AppLoader`) before the session
 * resolves.
 */
export async function mockSignedIn(
    page: Page,
    user: Partial<typeof DEFAULT_USER> = {},
    { delayMs }: { delayMs?: number } = {}
): Promise<void> {
    await page.route('**/api/auth/me', async (route) => {
        if (delayMs) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ...DEFAULT_USER, ...user })
        });
    });
}

/**
 * Stub `GET /api/auth/me` as **signed out** (`401`). With this, every private
 * route redirects to the sign-in page. Use it for the logged-out cases and to
 * keep the login-page suite deterministic (the auth probe never hits a real
 * backend).
 */
export async function mockSignedOut(page: Page): Promise<void> {
    await page.route('**/api/auth/me', async (route) => {
        await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Unauthorized' })
        });
    });
}

/**
 * Answer `401` on any request matching `urlPattern` — the shape a live tab sees
 * the moment its session stops being valid (revoked elsewhere, expired, or the
 * account suspended by an admin). Register it **after** the endpoint's normal
 * mock: later routes win, so a test can browse with real data and then flip a
 * single endpoint to "session lost" mid-visit.
 */
export async function mockUnauthorized(
    page: Page,
    urlPattern: string
): Promise<void> {
    await page.route(urlPattern, async (route) => {
        await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Unauthorized' })
        });
    });
}

/**
 * Stub `POST /api/auth/logout` (always succeeds) and record each call, so a
 * test can assert the account menu's Logout triggered it.
 */
export async function spyLogout(
    page: Page
): Promise<{ readonly count: number }> {
    let count = 0;
    await page.route('**/api/auth/logout', async (route) => {
        count += 1;
        await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true })
        });
    });
    return {
        get count() {
            return count;
        }
    };
}

/** Tracks calls to the login endpoint — to assert it is (not) hit. */
export interface LoginSpy {
    readonly count: number;
}

/**
 * Like {@link mockLogin} (always 201) but records each call, so a test can
 * assert the request was suppressed — e.g. blocked by client-side validation.
 */
export async function spyLogin(page: Page): Promise<LoginSpy> {
    let count = 0;
    await page.route('**/api/auth/login', async (route) => {
        count += 1;
        await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true })
        });
    });
    return {
        get count() {
            return count;
        }
    };
}
