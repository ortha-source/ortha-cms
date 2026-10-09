import { expect, test } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockContentSchema } from '../support/api/content';
import { frame, mockCopilotApi } from '../support/api/copilot';

const WORKSPACE_ID = 'ws_marketing';
const THREAD = 'Which articles are missing a summary?';

/**
 * The rail says what a thread is **doing**: a spinner while an answer
 * streams, an amber dot while a run waits on a question only the user can
 * answer — both in words too, in the row's accessible name.
 */
test.describe('Agents view — what a thread is doing', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
        await mockContentSchema(page);
    });

    test('marks a thread as working while its answer streams, and stops after', async ({
        page,
        agentsPage
    }) => {
        await mockCopilotApi(page, { runDelayMs: 2_500, persistRuns: true });
        await agentsPage.gotoThread(WORKSPACE_ID, 'c_summary');
        await agentsPage.composer().waitFor();

        await agentsPage.ask('And the drafts?');

        await expect(
            agentsPage.railRowWithStatus(THREAD, 'Working…')
        ).toBeVisible();
        // Done: the row is its name again.
        await expect(agentsPage.railRow(THREAD)).toBeVisible({
            timeout: 10_000
        });
    });

    test('marks a thread waiting on a permission prompt', async ({
        page,
        agentsPage
    }) => {
        await mockCopilotApi(page, {
            persistRuns: true,
            runBody: (conversationId) =>
                [
                    frame({
                        type: 'run-started',
                        runId: 'r_ask',
                        conversationId
                    }),
                    frame({
                        type: 'text-delta',
                        text: 'I can delete that draft for you.'
                    }),
                    frame({
                        type: 'tool-permission-request',
                        id: 'call_ask',
                        runId: 'r_ask',
                        name: 'content_delete',
                        input: { contentType: 'article', id: 'e42' },
                        expiresAt: new Date(Date.now() + 300_000).toISOString()
                    })
                ].join('')
        });
        await agentsPage.gotoThread(WORKSPACE_ID, 'c_summary');
        await agentsPage.composer().waitFor();

        await agentsPage.ask('Delete the stale draft');

        await expect(
            agentsPage.railRowWithStatus(THREAD, 'Waiting for your answer')
        ).toBeVisible();
    });
});
