import { expect, test } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockContentSchema } from '../support/api/content';
import { mockCopilotApi } from '../support/api/copilot';

const WORKSPACE_ID = 'ws_marketing';
const THREAD = 'Which articles are missing a summary?';

/**
 * Renaming and archiving — the row's `⋯` menu, its dialog, and the two disjoint
 * lists a thread moves between.
 *
 * **There is no Delete**, and one of the cases below holds that line: a thread's
 * proposals are the receipts for changes actually made to the user's content, so
 * destroying a conversation destroys the only record of those edits. Archiving
 * is reversible, keeps the transcript, and is the part people actually want.
 */
test.describe('Agents view — renaming and archiving', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
        await mockContentSchema(page);
    });

    test('renames a thread, and the rail and the bar both follow', async ({
        page,
        agentsPage
    }) => {
        const spy = await mockCopilotApi(page);
        await agentsPage.gotoThread(WORKSPACE_ID, 'c_summary');
        await agentsPage.railRow(THREAD).waitFor();

        await agentsPage.renameChat(THREAD, 'Summary audit');

        await expect(agentsPage.renameDialog()).toBeHidden();
        await expect(agentsPage.toast('Chat renamed.')).toBeVisible();
        await expect(agentsPage.railRow('Summary audit')).toBeVisible();
        await expect(agentsPage.breadcrumbLeaf()).toHaveText('Summary audit');
        expect(spy.patches).toEqual([
            { id: 'c_summary', body: { title: 'Summary audit' } }
        ]);
    });

    test('refuses a blank name with a reason, not a dead Save button', async ({
        page,
        agentsPage
    }) => {
        const spy = await mockCopilotApi(page);
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.railRow(THREAD).waitFor();

        await agentsPage.chooseRowAction(THREAD, 'Rename…');
        await agentsPage.renameInput().fill('   ');
        // Enabled, deliberately: a greyed-out Save refuses without saying why,
        // and on a field the user has not blurred there is no message either.
        await expect(agentsPage.renameSave()).toBeEnabled();
        await agentsPage.renameSave().click();

        await expect(agentsPage.renameError('Enter a name.')).toBeVisible();
        await expect(agentsPage.renameDialog()).toBeVisible();
        expect(spy.patches).toEqual([]);
    });

    test('says so when the server refuses the rename', async ({
        page,
        agentsPage
    }) => {
        await mockCopilotApi(page, { patchStatus: 500 });
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.railRow(THREAD).waitFor();

        await agentsPage.renameChat(THREAD, 'Summary audit');

        // The dialog stays open, because that is where the user's typing is.
        await expect(
            agentsPage.renameError(/Could not rename the chat/)
        ).toBeVisible();
        await expect(agentsPage.renameDialog()).toBeVisible();
    });

    test('gives focus back to the row that opened the dialog', async ({
        page,
        agentsPage
    }) => {
        await mockCopilotApi(page);
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.railRow(THREAD).waitFor();

        await agentsPage.chooseRowAction(THREAD, 'Rename…');
        await agentsPage.renameCancel().click();

        // The dialog is opened from a menu item that unmounts with its menu, so
        // Radix has nothing left to restore focus to and drops it on `<body>` —
        // stranding a keyboard user at the top of the page.
        await expect(agentsPage.rowMenuTrigger(THREAD)).toBeFocused();
    });

    test('archives a thread, and only then offers the archive', async ({
        page,
        agentsPage
    }) => {
        const spy = await mockCopilotApi(page);
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.railRow(THREAD).waitFor();

        // A permanent "Archived (0)" is a door to an empty room.
        await expect(agentsPage.archivedLink()).toBeHidden();

        await agentsPage.chooseRowAction(THREAD, 'Archive');

        await expect(agentsPage.toast('Chat archived.')).toBeVisible();
        await expect(agentsPage.railRow(THREAD)).toBeHidden();
        expect(spy.patches).toEqual([
            { id: 'c_summary', body: { archived: true } }
        ]);
        // The link appearing is the assertion: every write here moves a thread
        // *between* the two lists, so invalidating only the one on screen left
        // the archive stale and this link permanently absent.
        await expect(agentsPage.archivedLink()).toBeVisible();
    });

    test('restores a thread from the archived list', async ({
        page,
        agentsPage
    }) => {
        await mockCopilotApi(page);
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.railRow(THREAD).waitFor();
        await agentsPage.chooseRowAction(THREAD, 'Archive');
        await agentsPage.archivedLink().click();

        await expect(agentsPage.railRow(THREAD)).toBeVisible();
        await expect(agentsPage.railNewChat()).toBeHidden();

        await agentsPage.chooseRowAction(THREAD, 'Unarchive');

        await expect(agentsPage.toast('Chat restored.')).toBeVisible();
        await agentsPage.backToChats().click();
        await expect(agentsPage.railRow(THREAD)).toBeVisible();
    });

    test('archiving the thread you are reading starts a new chat', async ({
        page,
        agentsPage
    }) => {
        await mockCopilotApi(page);
        await agentsPage.gotoThread(WORKSPACE_ID, 'c_summary');
        await expect(agentsPage.transcript()).toBeVisible();

        await agentsPage.chooseRowAction(THREAD, 'Archive');

        // Otherwise you are left reading a conversation that is in no list.
        await expect(page).toHaveURL(
            new RegExp(`/workspaces/${WORKSPACE_ID}/agents$`)
        );
        await expect(agentsPage.welcomeHeading()).toBeVisible();
    });

    test('the row menu offers no way to destroy a thread', async ({
        page,
        agentsPage
    }) => {
        await mockCopilotApi(page);
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.railRow(THREAD).waitFor();

        await agentsPage.openRowMenu(THREAD);

        await expect(agentsPage.rowMenuItem('Rename…')).toBeVisible();
        await expect(agentsPage.rowMenuItem('Archive')).toBeVisible();
        // A product decision, not a gap — see the suite's note above.
        await expect(
            page.getByRole('menuitem', { name: /Delete/ })
        ).toHaveCount(0);
    });
});
