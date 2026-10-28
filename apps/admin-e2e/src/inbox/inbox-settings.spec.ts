import { type Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { expectNoA11yViolations } from '../support/a11y';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { LIBRARY_WORKSPACE, mockContentSchema } from '../support/api/content';
import { mockInbox } from '../support/api/inbox';
import { mockDigestSettings } from '../support/api/alarms';

const frequency = (page: Page) =>
    page.getByRole('radiogroup', { name: 'Alarm digest' });

/**
 * `/inbox/settings` — the reader's notification settings. The inbox owns the
 * page; alarms contributes the digest's frequency through
 * `INBOX_SETTINGS_SLOT`, and the digest mail links here.
 */
test.describe('Notification settings', () => {
    test.beforeEach(async ({ page }) => {
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await mockContentSchema(page);
        await mockInbox(page, []);
    });

    test('is reached from the inbox', async ({ page }) => {
        await mockSignedIn(page);
        await mockDigestSettings(page);
        await page.goto('/inbox');

        await page.getByRole('link', { name: 'Notification settings' }).click();

        await expect(page).toHaveURL(/\/inbox\/settings$/);
        await expect(
            page.getByRole('heading', {
                name: 'Notification settings',
                level: 1
            })
        ).toBeVisible();
    });

    test('saves the alarm digest frequency', async ({ page }) => {
        await mockSignedIn(page);
        const recorder = await mockDigestSettings(page, {
            frequency: 'daily'
        });
        await page.goto('/inbox/settings');

        await expect(
            frequency(page).getByRole('radio', { name: 'Daily' })
        ).toHaveAttribute('aria-checked', 'true');
        await frequency(page).getByRole('radio', { name: 'Weekly' }).click();

        await expect(
            page.getByText('You will get the alarm digest weekly, on Mondays.')
        ).toBeVisible();
        expect(recorder.saved).toEqual(['weekly']);
        await expect(
            frequency(page).getByRole('radio', { name: 'Weekly' })
        ).toHaveAttribute('aria-checked', 'true');
    });

    test('says why the digest cannot be changed without mail', async ({
        page
    }) => {
        await mockSignedIn(page);
        await mockDigestSettings(page, { available: false });
        await page.goto('/inbox/settings');

        await expect(page.getByText(/has no mail configured/)).toBeVisible();
        await expect(
            frequency(page).getByRole('radio', { name: 'Off' })
        ).toBeDisabled();
    });

    test('says a failed read is a failure', async ({ page }) => {
        await mockSignedIn(page);
        await mockDigestSettings(page, { status: 500 });
        await page.goto('/inbox/settings');

        await expect(page.getByRole('alert')).toContainText(
            'Could not load your digest setting.'
        );
    });

    // Without `alarms:read` the digest would list nothing, so it is not offered.
    test('has nothing to set for a reader without alarms', async ({ page }) => {
        await mockSignedIn(page, {
            permissions: ['workspaces:read', 'content:read']
        });
        await mockDigestSettings(page);
        await page.goto('/inbox/settings');

        await expect(
            page.getByRole('heading', { name: 'Notification settings' })
        ).toBeVisible();
        await expect(
            page.getByRole('heading', { name: 'Alarm digest' })
        ).toHaveCount(0);
    });

    test('has no accessibility violations', async ({ page, makeAxe }) => {
        await mockSignedIn(page);
        await mockDigestSettings(page);
        await page.goto('/inbox/settings');
        await expect(frequency(page)).toBeVisible();
        await expectNoA11yViolations(makeAxe());
    });
});
