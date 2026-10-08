import { expect, test } from '../support/fixtures';
import { mockLogin, mockSignedIn, spyLogout } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockContentSchema } from '../support/api/content';
import { mockCopilotApi, spyRunAborts } from '../support/api/copilot';

const WORKSPACE_ID = 'ws_marketing';
const PASSWORD = 'SecurePass123!';

/**
 * The chats across a change of **who is signed in**.
 *
 * They live in module state outside React, so that navigating cannot cancel a
 * run — and so nothing that unmounted on sign-out took them with it either.
 * The query cache was swept on every change of identity; the dock was not, so
 * the next person to sign in on the tab, in the same page load, opened it onto
 * the previous account's conversations while a run that account started kept
 * streaming.
 */
test.describe('Ortha CMS AI across a change of account', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page, {
            id: 'u_ada',
            name: 'Ada Lovelace',
            email: 'ada@orthacms.dev'
        });
        await mockWorkspaces(page);
        await mockContentSchema(page);
        await spyLogout(page);
    });

    test('the next account does not inherit the previous one’s chats', async ({
        page,
        loginPage,
        contentLibraryPage,
        copilotDockPage
    }) => {
        await mockCopilotApi(page);
        await contentLibraryPage.goto(WORKSPACE_ID);
        await copilotDockPage.startChat();
        await copilotDockPage.startChat();
        await expect(copilotDockPage.launcher).toHaveAccessibleName(/2 chats/);

        await contentLibraryPage.openAccountMenu();
        await contentLibraryPage.accountMenuItem('Logout').click();
        await expect(loginPage.heading).toBeVisible();

        // Somebody else, on the same tab and in the same page load — a reload
        // would wipe module state and prove nothing. The gate stashed the
        // workspace page, so the sign-in comes straight back to it.
        await mockLogin(page, { status: 201 });
        await mockSignedIn(page, {
            id: 'u_grace',
            name: 'Grace Hopper',
            email: 'grace@orthacms.dev'
        });
        await loginPage.login('grace@orthacms.dev', PASSWORD);
        await expect(page).toHaveURL(new RegExp(`/workspaces/${WORKSPACE_ID}`));

        await expect(copilotDockPage.launcher).toHaveAccessibleName(
            'Ask Ortha AI'
        );
        await expect(copilotDockPage.windows()).toHaveCount(0);
    });

    test('signing out cancels a run still in flight', async ({
        page,
        loginPage,
        contentLibraryPage,
        copilotDockPage
    }) => {
        // Held open far past the test, so the only way the request ends is
        // the client giving up on it.
        await mockCopilotApi(page, { runDelayMs: 60_000 });
        const aborts = await spyRunAborts(page);
        await contentLibraryPage.goto(WORKSPACE_ID);

        await copilotDockPage.startChat();
        const started = page.waitForRequest('**/api/copilot/runs');
        await copilotDockPage.ask('Which articles are missing a summary?');
        await started;
        expect(await aborts.count()).toBe(0);

        await contentLibraryPage.openAccountMenu();
        await contentLibraryPage.accountMenuItem('Logout').click();
        await expect(loginPage.heading).toBeVisible();

        // Cancelling the fetch is also what stops the run server-side: a
        // client disconnect is an abort there.
        await expect.poll(() => aborts.count()).toBe(1);
    });
});
