import { expect, test } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockContentSchema } from '../support/api/content';
import { mockCopilotApi, parkedRun } from '../support/api/copilot';

const WORKSPACE_ID = 'ws_marketing';

/**
 * The sidebar's CMS ⇄ Agents control — the answer to "how do I get back?".
 *
 * A full page reached from a nav row is a place people get stuck: the way out is
 * wherever they happen to remember. A control on screen in *both* modes says
 * there are two of them, which one you are in, and costs one click either way —
 * and the CMS half returns to the page you left, because breaking off mid-entry
 * to ask a question should not cost you your place.
 */
test.describe('CMS ⇄ Agents switcher', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
        await mockContentSchema(page);
        await mockCopilotApi(page);
    });

    test('says which view you are in, in both of them', async ({
        agentsPage,
        contentLibraryPage
    }) => {
        await contentLibraryPage.goto(WORKSPACE_ID);
        await expect(agentsPage.viewTab('CMS')).toHaveAttribute(
            'aria-checked',
            'true'
        );

        await agentsPage.switchView('Agents');

        await expect(agentsPage.viewTab('Agents')).toHaveAttribute(
            'aria-checked',
            'true'
        );
        await expect(agentsPage.viewTab('CMS')).toHaveAttribute(
            'aria-checked',
            'false'
        );
    });

    test('in Agents the chats replace the content tree, and switching back restores it', async ({
        page,
        agentsPage,
        contentLibraryPage
    }) => {
        await contentLibraryPage.goto(WORKSPACE_ID);
        await expect(contentLibraryPage.sidebar).toBeVisible();
        await expect(agentsPage.rail).toHaveCount(0);

        await agentsPage.switchView('Agents');

        // R7: "Agents mode swaps the content tree for your chats".
        await expect(agentsPage.rail).toBeVisible();
        await expect(contentLibraryPage.sidebar).toHaveCount(0);
        await expect(
            page.getByRole('navigation', { name: 'Tools' })
        ).toHaveCount(0);
        await expect(agentsPage.railNewChat()).toBeVisible();
        await expect(agentsPage.manageSkillsLink()).toBeVisible();

        await agentsPage.switchView('CMS');
        await expect(contentLibraryPage.sidebar).toBeVisible();
        await expect(agentsPage.rail).toHaveCount(0);
    });

    test('⌘J on the Agents view starts a new chat on the page', async ({
        page,
        agentsPage
    }) => {
        await agentsPage.gotoThread(WORKSPACE_ID, 'c_summary');
        await expect(agentsPage.transcript()).toBeVisible();

        await page.keyboard.press('Control+j');

        await expect(page).toHaveURL(
            new RegExp(`/workspaces/${WORKSPACE_ID}/agents$`)
        );
        await expect(agentsPage.welcomeHeading()).toBeVisible();
    });

    test('goes back to the CMS page you left, not the workspace root', async ({
        page,
        agentsPage,
        contentLibraryPage
    }) => {
        await contentLibraryPage.goto(WORKSPACE_ID);
        await contentLibraryPage.sidebar.waitFor();
        const left = new URL(page.url()).pathname;

        await agentsPage.switchView('Agents');
        await expect(agentsPage.welcomeHeading()).toBeVisible();

        await agentsPage.switchView('CMS');

        await expect(page).toHaveURL(new RegExp(`${left}$`));
    });

    test('clicking the view you are already in is not a third state', async ({
        page,
        agentsPage
    }) => {
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        // Radix clears the value when the selected item is clicked again; that
        // is a deselect, and there is nowhere for the user to land.
        await agentsPage.switchView('Agents');

        await expect(page).toHaveURL(
            new RegExp(`/workspaces/${WORKSPACE_ID}/agents$`)
        );
        await expect(agentsPage.viewTab('Agents')).toHaveAttribute(
            'aria-checked',
            'true'
        );
    });

    test('the dock stands down on the Agents view', async ({
        agentsPage,
        contentLibraryPage
    }) => {
        await contentLibraryPage.goto(WORKSPACE_ID);
        // On the CMS the launcher is the entry point — with no chats open it is
        // a labelled "Ask Ortha AI" button in the strip under the card.
        await expect(agentsPage.dockLauncher).toBeVisible();

        await agentsPage.switchView('Agents');

        // Here it would offer to open the page you are already on.
        await expect(agentsPage.dock).toBeHidden();
    });

    test('…and stays down even when it owns a chat', async ({
        agentsPage,
        contentLibraryPage,
        copilotDockPage
    }) => {
        // A chat opened on the CMS, so the dock owns a pill *and* a window.
        await contentLibraryPage.goto(WORKSPACE_ID);
        await copilotDockPage.startChat();
        await expect(copilotDockPage.panel()).toBeVisible();

        await agentsPage.switchView('Agents');

        // The page is the chat surface now, so a floating window over it is a
        // second one saying the same thing — the launcher and the windows both
        // go.
        await expect(agentsPage.dock).toBeHidden();
        await expect(copilotDockPage.panel()).toBeHidden();

        // Back on the CMS both are there again — hidden, never closed, so a
        // chat that was running was not thrown away behind the user's back.
        await agentsPage.switchView('CMS');
        await expect(agentsPage.dock).toBeVisible();
        await expect(copilotDockPage.panel()).toBeVisible();
    });

    // A count of open chats moved as chats were handed between the page and
    // the dock, so it blinked out and back on a plain switch to the CMS. Only
    // a chat waiting on the user marks the segment now.
    test('the Agents segment draws no count for open chats', async ({
        agentsPage,
        contentLibraryPage,
        copilotDockPage
    }) => {
        await contentLibraryPage.goto(WORKSPACE_ID);
        await copilotDockPage.startChat();
        await copilotDockPage.ask('Set the summary please');

        await expect(agentsPage.viewTab('Agents')).toHaveAccessibleName(
            'Agents'
        );
        await expect(agentsPage.viewTab('Agents')).not.toContainText(/\d/);
        await expect(agentsPage.viewTabMarker('Agents')).toHaveCount(0);
    });

    test('…nor a dot for a chat that only finished', async ({
        page,
        agentsPage,
        contentLibraryPage,
        copilotDockPage
    }) => {
        // Held open so the window is collapsed while the run is still going —
        // `unread` is only ever set on a chat that is off screen when it ends.
        await mockCopilotApi(page, { runDelayMs: 1_500 });
        await contentLibraryPage.goto(WORKSPACE_ID);
        await copilotDockPage.startChat();
        await copilotDockPage.ask('Set the summary please');
        await copilotDockPage.composer().press('Escape');

        // Finished, as the pill says…
        await copilotDockPage.openChatList();
        await expect(copilotDockPage.pill(/— finished/)).toBeVisible();
        // …and asking nothing of the user, so nothing on the way in.
        await expect(agentsPage.viewTab('Agents')).toHaveAccessibleName(
            'Agents'
        );
        await expect(agentsPage.viewTabMarker('Agents')).toHaveCount(0);
    });

    test('marks a chat waiting for you, on the Agents view too', async ({
        page,
        agentsPage,
        contentLibraryPage,
        copilotDockPage
    }) => {
        await mockCopilotApi(page, { runBody: parkedRun });
        await contentLibraryPage.goto(WORKSPACE_ID);
        await copilotDockPage.startChat();
        await copilotDockPage.ask('Delete the stale draft');

        await expect(agentsPage.viewTab('Agents')).toHaveAccessibleName(
            'Agents — 1 chat waiting for you'
        );
        await expect(agentsPage.viewTabMarker('Agents')).toHaveCount(1);

        // The launcher stands down here, so this is the one place left that
        // still says the chat in the background is blocked on the user.
        await agentsPage.switchView('Agents');
        await expect(agentsPage.dock).toBeHidden();
        await expect(agentsPage.viewTab('Agents')).toHaveAccessibleName(
            'Agents — 1 chat waiting for you'
        );
    });

    // The bug the count had: switching views handed the chat between the page
    // and the dock, and the marker on the way in blinked with it.
    test('keeps the marker while a waiting chat moves between the page and the dock', async ({
        page,
        agentsPage,
        copilotDockPage
    }) => {
        await mockCopilotApi(page, { runBody: parkedRun });
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();
        await agentsPage.ask('Delete the stale draft');
        await expect(agentsPage.viewTab('Agents')).toHaveAccessibleName(
            'Agents — 1 chat waiting for you'
        );

        await agentsPage.switchView('CMS');
        await expect(agentsPage.viewTab('Agents')).toHaveAccessibleName(
            'Agents — 1 chat waiting for you'
        );
        // Handed to the dock as a pill, which says so in words.
        await expect(copilotDockPage.pill(/— waiting for you$/)).toBeVisible();

        await agentsPage.switchView('Agents');
        await agentsPage
            .railRowWithStatus(
                'Set the summary please',
                'Waiting for your answer'
            )
            .click();
        await expect(agentsPage.viewTab('Agents')).toHaveAccessibleName(
            'Agents — 1 chat waiting for you'
        );
    });
});
