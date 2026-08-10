import { expect, test } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockContentSchema } from '../support/api/content';
import { mockCopilotApi } from '../support/api/copilot';

const WORKSPACE_ID = 'ws_marketing';

/**
 * The Agents view's **writing** half: asking something, what the answer looks
 * like as it lands, and the two things that must survive leaving the page — the
 * run itself, and the model the user picked.
 *
 * The run route is stubbed as a real `text/event-stream`, so the transcript here
 * is built by the same reducer a live server drives. What the stub cannot
 * reproduce is frames arriving progressively; everything about the finished turn
 * — its prose, its steps, its change card and their **order** — is exactly what
 * the server would produce.
 */
test.describe('Agents view — asking', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
        await mockContentSchema(page);
    });

    test('asks, promotes the URL to the new thread, and answers in order', async ({
        page,
        agentsPage
    }) => {
        const spy = await mockCopilotApi(page);
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        await agentsPage.ask('Set the summary please');

        // The first turn mints a thread id, and the URL adopts it — `replace`,
        // so "new chat" and "that chat" are one step in the browser's history.
        await expect(page).toHaveURL(
            new RegExp(`/workspaces/${WORKSPACE_ID}/agents/c_new$`)
        );
        expect(spy.runs[0]).toMatchObject({
            message: 'Set the summary please'
        });

        await expect(agentsPage.toolStep(/Updated an entry/)).toBeVisible();
        await expect(agentsPage.proposalCard(/Set a summary on/)).toBeVisible();

        const text = await agentsPage.transcriptText();
        expect(
            text.indexOf('Setting the summary on that article')
        ).toBeLessThan(text.indexOf('Updated an entry'));
        expect(text.indexOf('Updated an entry')).toBeLessThan(
            text.indexOf('Set a summary on')
        );
        // The sentence written *after* the change renders after the receipt for
        // it, which is the whole point of a turn being an ordered block list.
        expect(text.indexOf('Set a summary on')).toBeLessThan(
            text.indexOf('Afterwards: the change is saved.')
        );
    });

    test('switching threads is navigation, so Back moves between them', async ({
        page,
        agentsPage
    }) => {
        await mockCopilotApi(page);
        await agentsPage.goto(WORKSPACE_ID);

        await agentsPage
            .railRow('Which articles are missing a summary?')
            .click();
        await expect(agentsPage.transcript()).toBeVisible();
        await agentsPage.railRow('Rewrite the pricing page intro').click();
        await expect(page).toHaveURL(/\/agents\/c_pricing$/);

        await page.goBack();

        // The URL is the thread, which is what makes the browser's own Back
        // button work here at all.
        await expect(page).toHaveURL(/\/agents\/c_summary$/);
        await expect(
            agentsPage.railRow('Which articles are missing a summary?')
        ).toHaveAttribute('aria-current', 'page');
    });

    test('sends the picked model, and still has it after a trip through the CMS', async ({
        page,
        agentsPage
    }) => {
        const spy = await mockCopilotApi(page);
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        await expect(agentsPage.modelPicker()).toContainText('Default');
        await agentsPage.chooseModel('gpt-5.2');
        await expect(agentsPage.modelPicker()).toContainText('gpt-5.2');

        await agentsPage.ask('Set the summary please');
        await expect.poll(() => spy.runs.length).toBe(1);
        expect(spy.runs[0]).toMatchObject({
            provider: 'openai',
            model: 'gpt-5.2'
        });

        // The reported bug: the choice lived in the component that drew the
        // picker, so leaving the page silently put the user back on the default.
        await agentsPage.switchView('CMS');
        await agentsPage.switchView('Agents');

        await expect(agentsPage.modelPicker()).toContainText('gpt-5.2');
    });

    test('the composer grows with what you type, up to a ceiling', async ({
        page,
        agentsPage
    }) => {
        await mockCopilotApi(page);
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        const twoRows = await agentsPage.composerHeight();

        await agentsPage.composer().fill('a paragraph\n'.repeat(4));
        const grown = await agentsPage.composerHeight();
        expect(grown).toBeGreaterThan(twoRows);

        await agentsPage.composer().fill('a paragraph\n'.repeat(40));
        const capped = await agentsPage.composerHeight();
        // ~six lines, and then it scrolls — a composer without a ceiling eats
        // the answer it is a reply to.
        expect(capped).toBeLessThanOrEqual(160);

        // And back down: `scrollHeight` never reports less than the height
        // already set, so shrinking is the half that breaks first.
        await agentsPage.composer().fill('short');
        expect(await agentsPage.composerHeight()).toBeLessThan(grown);
    });

    test('a run outlives the page it started on, and says so', async ({
        page,
        agentsPage
    }) => {
        await mockCopilotApi(page, { runDelayMs: 2_000 });
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        await agentsPage.ask('Set the summary please');
        await expect(agentsPage.stopButton()).toBeVisible();

        // Leaving mid-answer used to be a disguised Stop. Now the chat is handed
        // to the dock as a live pill and keeps streaming.
        await agentsPage.switchView('CMS');

        await expect(agentsPage.dockPill(/finished/)).toBeVisible({
            timeout: 15_000
        });
        // …and the tab says so too, for a user who has switched to another one.
        await expect.poll(() => page.title()).toMatch(/^\(1\)/);
    });

    test('stopping a run leaves a note rather than an error', async ({
        page,
        agentsPage
    }) => {
        await mockCopilotApi(page, { runDelayMs: 10_000 });
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        await agentsPage.ask('Set the summary please');
        await agentsPage.stopButton().click();

        // Cancelling is something the user did on purpose, so it gets a quiet
        // line — not the destructive alert a failed turn gets.
        await expect(
            agentsPage.transcript().getByText('You stopped this answer.')
        ).toBeVisible();
        await expect(agentsPage.sendButton()).toBeVisible();
    });
});
