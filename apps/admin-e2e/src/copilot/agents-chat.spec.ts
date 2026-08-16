import { expect, test } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockContentSchema } from '../support/api/content';
import { frame, mockCopilotApi } from '../support/api/copilot';

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

/**
 * The five defects a QA pass found in the transcript and the composer.
 *
 * Note what is **not** here: the streaming experience. `page.route` delivers the
 * SSE body in one read, so every assertion below is about a run's frames landing
 * — which is enough for all five, because each is a rule about what the app does
 * *when the transcript changes*, not about how fast the changes arrive.
 */
test.describe('Agents view — regressions', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
        await mockContentSchema(page);
    });

    test('sending while a run is in flight says why, instead of silence', async ({
        page,
        agentsPage
    }) => {
        const spy = await mockCopilotApi(page, { runDelayMs: 4_000 });
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        await agentsPage.ask('Set the summary please');
        await expect(agentsPage.stopButton()).toBeVisible();

        // A second question, mid-answer. The send is correctly refused — one
        // run per chat — and the typed text is correctly kept. What was missing
        // is any indication of either, so someone who had not noticed the
        // button become Stop read it as a dropped keystroke.
        await agentsPage.composer().fill('And the headline too');
        await agentsPage.composer().press('Enter');

        await expect(agentsPage.composerHint()).toContainText(
            /Still answering/
        );
        // Kept, not sent: the text is still in the box and no second run went.
        await expect(agentsPage.composer()).toHaveValue('And the headline too');
        expect(spy.runs).toHaveLength(1);

        // And the notice does not outlive the state that caused it.
        await expect(agentsPage.sendButton()).toBeVisible({ timeout: 15_000 });
        await expect(agentsPage.composerHint()).toContainText(/Enter to send/);
    });

    test('a truncated run explains itself in a translatable sentence', async ({
        page,
        agentsPage
    }) => {
        await mockCopilotApi(page, {
            runBody: (conversationId) =>
                [
                    frame({
                        type: 'run-started',
                        runId: 'r_t',
                        conversationId
                    }),
                    frame({ type: 'text-delta', text: 'Halfway through…' }),
                    frame({
                        type: 'done',
                        messageId: 'm_t',
                        stopReason: 'max-steps'
                    })
                ].join('')
        });
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        await agentsPage.ask('Do something long');

        // A warning, not a destructive alert: the answer is real, just short.
        // The reason fragment used to be a bare English literal interpolated
        // into the translated frame around it, so no extractor could see it and
        // no catalogue could ever translate it — the sentence localized and the
        // half carrying its meaning did not.
        await expect(
            agentsPage
                .transcript()
                .getByText(
                    'Stopped because it reached the maximum number of steps.'
                )
        ).toBeVisible();
        // The partial answer is kept beside it.
        await expect(agentsPage.transcript()).toContainText('Halfway through');
    });

    test('a failed step says it failed, even when the tool returned a summary', async ({
        page,
        agentsPage
    }) => {
        await mockCopilotApi(page, {
            runBody: (conversationId) =>
                [
                    frame({
                        type: 'run-started',
                        runId: 'r_f',
                        conversationId
                    }),
                    frame({
                        type: 'tool-call',
                        id: 'call_f',
                        name: 'content_propose_update',
                        input: { contentType: 'article', id: 'e42' }
                    }),
                    // The shape a failed apply actually arrives in since the
                    // server pass: `ok: false`, **with** a summary. The step's
                    // "Failed" used to be the `??` fallback for having no
                    // summary at all, so the one case most likely to reach a
                    // user was the one that never said so.
                    frame({
                        type: 'tool-result',
                        id: 'call_f',
                        ok: false,
                        summary: 'failed: set the number',
                        error: 'value out of range',
                        durationMs: 12
                    }),
                    frame({
                        type: 'done',
                        messageId: 'm_f',
                        stopReason: 'end'
                    })
                ].join('')
        });
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        await agentsPage.ask('Set the number');

        // The status is in the step's accessible name, not only in a red ring
        // and a colour — which is nothing at all to a screen reader (1.4.1).
        const step = agentsPage.toolStep(/Updated an entry/);
        await expect(step).toBeVisible();
        await expect(step).toHaveAccessibleName(/Failed/);
        // The tool's own line still shows, after the status rather than
        // instead of it.
        await expect(step).toContainText('failed: set the number');
    });

    test('a table in an answer has headers, a name, and a scroll region a keyboard can reach', async ({
        page,
        agentsPage
    }) => {
        await mockCopilotApi(page, {
            runBody: (conversationId) =>
                [
                    frame({
                        type: 'run-started',
                        runId: 'r_x',
                        conversationId
                    }),
                    frame({
                        type: 'text-delta',
                        text: '| Type | Entries |\n| --- | --- |\n| Article | 12 |\n'
                    }),
                    frame({
                        type: 'done',
                        messageId: 'm_x',
                        stopReason: 'end'
                    })
                ].join('')
        });
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        await agentsPage.ask('List the content types');

        const table = agentsPage.transcript().getByRole('table');
        await expect(table).toBeVisible();
        // Named, so it is not announced as an anonymous "table with 2 columns".
        await expect(table).toHaveAccessibleName('Table in this answer');
        // `scope="col"`, without which cell navigation announces bare values.
        await expect(
            table.getByRole('columnheader', { name: 'Type' })
        ).toHaveAttribute('scope', 'col');
        // The wrapper scrolls sideways, so it has to be focusable — a scroll
        // container with no tab stop hides its right-hand columns from anyone
        // without a mouse (2.1.1).
        await expect(
            agentsPage
                .transcript()
                .getByRole('region', { name: 'Table in this answer' })
        ).toHaveAttribute('tabindex', '0');
    });
});
