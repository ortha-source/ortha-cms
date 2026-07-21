import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockMembers } from '../support/api/members';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockPreferences } from '../support/api/preferences';
import {
    mockEmptyActivity,
    mockUserDetail,
    mockUserSessions
} from '../support/api/userDetail';
import { expectNoA11yViolations } from '../support/a11y';

/**
 * The self-only **Preferences** tab on the user detail page
 * (`/users/:id/preferences`, `@ortha-cms/users-admin`): the colour-theme picker
 * (Light / Dark / System). Signed in as Ada (a member in the roster) so viewing
 * her own detail page is "self"; viewing another member is not. Theme reads/
 * writes go through the `mockPreferences` stub. `mockSignedIn` satisfies the
 * shell's auth probe (and, since it matches the viewed id, unlocks the tab).
 */
test.describe('User preferences (theme)', () => {
    const SELF = {
        id: 'u_ada',
        name: 'Ada Lovelace',
        email: 'ada@ortha.dev'
    };

    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page, SELF);
        await mockMembers(page);
        await mockWorkspaces(page);
        await mockEmptyActivity(page);
        await mockUserSessions(page);
        await mockUserDetail(page);
    });

    test('shows the Preferences tab only on your own profile', async ({
        page,
        userDetailPage
    }) => {
        await mockPreferences(page);

        // Your own profile — the tab is present.
        await userDetailPage.goto('u_ada');
        await expect(userDetailPage.tab('Preferences')).toBeVisible();

        // Another member's profile — no Preferences tab.
        await userDetailPage.goto('u_grace');
        await expect(userDetailPage.heading('Grace Hopper')).toBeVisible();
        await expect(userDetailPage.tab('Preferences')).toHaveCount(0);
    });

    test('redirects a deep link to someone else’s preferences', async ({
        page,
        userDetailPage
    }) => {
        await mockPreferences(page);
        await page.goto('/users/u_grace/preferences');

        // Self-only route → falls back to that member's General tab.
        await expect(page).toHaveURL(/\/users\/u_grace\/general/);
        await expect(userDetailPage.nameInput()).toHaveValue('Grace Hopper');
    });

    test('selecting a theme applies it and saves it (PUT /api/preferences)', async ({
        page,
        userDetailPage
    }) => {
        const prefs = await mockPreferences(page, { theme: 'system' });
        await page.goto('/users/u_ada/preferences');
        await expect(userDetailPage.themeOption('Dark')).toBeVisible();

        await userDetailPage.selectTheme('Dark');

        // Applied app-wide (the `.dark` class) and persisted (one PUT), with a
        // confirmation toast.
        await expect.poll(() => userDetailPage.isDark()).toBe(true);
        await expect.poll(() => prefs.puts).toEqual(['dark']);
        await expect(userDetailPage.savedToast()).toBeVisible();
    });

    test('does not re-save the theme already in effect', async ({
        page,
        userDetailPage
    }) => {
        const prefs = await mockPreferences(page, { theme: 'dark' });
        await page.goto('/users/u_ada/preferences');
        await expect(userDetailPage.themeOption('Dark')).toBeVisible();

        // Dark is already the stored/active theme — re-selecting it is a no-op.
        await userDetailPage.selectTheme('Dark');
        await expect(userDetailPage.themeOption('Light')).toBeVisible();
        expect(prefs.puts).toEqual([]);
    });

    test('hydrates the saved theme app-wide on load', async ({
        page,
        userDetailPage
    }) => {
        // A returning dark-theme user: the invisible ThemeSync pulls it from the
        // server and applies it on any authenticated route, before they ever
        // open the Preferences tab.
        await mockPreferences(page, { theme: 'dark' });
        await page.goto('/users');

        await expect.poll(() => userDetailPage.isDark()).toBe(true);
    });

    test('the account menu links to your own Preferences tab', async ({
        page,
        membersPage
    }) => {
        await mockPreferences(page);
        await membersPage.goto();
        await membersPage.openAccountMenu();
        await membersPage.accountMenuItem('Preferences').click();

        await expect(page).toHaveURL(/\/users\/u_ada\/preferences/);
    });

    test('the theme picker has no accessibility violations', async ({
        page,
        userDetailPage,
        makeAxe
    }) => {
        await mockPreferences(page);
        await page.goto('/users/u_ada/preferences');
        await expect(userDetailPage.themeOption('System')).toBeVisible();

        await expectNoA11yViolations(makeAxe());
    });
});
