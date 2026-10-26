import { type Page } from '@playwright/test';

/**
 * Stub `GET /api/auth/password-recovery` — whether the deployment sends
 * recovery mail. `false` is the default install (no mail provider), which is
 * also what the "Forgot it?" screen falls back to when it cannot tell.
 */
export async function mockPasswordRecoveryAvailability(
    page: Page,
    available: boolean
): Promise<void> {
    await page.route('**/api/auth/password-recovery', async (route) => {
        if (route.request().method() !== 'GET') {
            await route.fallback();
            return;
        }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ available })
        });
    });
}

/** What the recovery request spy has seen. */
export interface PasswordRecoverySpy {
    /** How many times the endpoint was hit. */
    readonly count: number;
    /** The bodies posted, in order. */
    readonly bodies: Record<string, unknown>[];
}

/**
 * Stub `POST /api/auth/password-recovery` and record each call. The real
 * server answers `202` with the same body for every address — that sameness
 * is the point — so the default is exactly that; pass a `status` for the
 * throttled (`429`) or no-mail (`404`) answers.
 */
export async function spyPasswordRecovery(
    page: Page,
    {
        status = 202,
        retryAfterSeconds
    }: { status?: number; retryAfterSeconds?: number } = {}
): Promise<PasswordRecoverySpy> {
    let count = 0;
    const bodies: Record<string, unknown>[] = [];

    await page.route('**/api/auth/password-recovery', async (route) => {
        if (route.request().method() !== 'POST') {
            await route.fallback();
            return;
        }
        count += 1;
        bodies.push(JSON.parse(route.request().postData() ?? '{}'));
        await route.fulfill({
            status,
            contentType: 'application/json',
            headers: retryAfterSeconds
                ? { 'retry-after': String(retryAfterSeconds) }
                : undefined,
            body: JSON.stringify(
                status === 202 ? { ok: true } : { message: 'Refused' }
            )
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
