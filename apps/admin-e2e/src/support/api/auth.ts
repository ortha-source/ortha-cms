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
