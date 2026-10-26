import { expect, test } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockContentSchema } from '../support/api/content';
import {
    mockCopilotApi,
    parkedRun,
    previewedRun
} from '../support/api/copilot';
import { expectNoA11yViolations } from '../support/a11y';

const WORKSPACE_ID = 'ws_marketing';
const PREVIEW = 'Write a summary for 23 articles';

/**
 * **Asking before a write, in words** (R7, `AiConversation`): steps as short
 * lines, then the change itself — "23 changes · Not saved", Was → Now per
 * record — and an amber prompt that says what will happen ("save 23 records
 * as drafts"; "published versions stay live") with Allow once / Allow for this
 * chat / Don't allow.
 */
test.describe('Agents view — asking before a write', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
        await mockContentSchema(page);
    });

    test('shows the change it would make, marked Not saved, and asks in words', async ({
        page,
        agentsPage
    }) => {
        await mockCopilotApi(page, { runBody: previewedRun });
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        await agentsPage.ask('Write a summary for every article missing one');

        // The step reads as a line, with the tool's own outcome.
        await expect(
            agentsPage.toolStep(/842 records · 23 have no summary/)
        ).toBeVisible();

        const card = agentsPage.proposalCard(PREVIEW);
        await expect(card).toContainText('23 changes');
        await expect(
            agentsPage.proposalBadge(PREVIEW, 'Not saved')
        ).toBeVisible();
        // Grouped under the record, Was → Now.
        await expect(card).toContainText('Spring launch — what changed');
        await expect(card).toContainText('Everything that shipped in spring.');

        const prompt = page.getByRole('group', {
            name: 'Ortha CMS AI wants to save 23 records as drafts'
        });
        await expect(prompt).toBeVisible();
        await expect(prompt).toHaveAccessibleDescription(
            'Published versions stay live until someone publishes the drafts.'
        );
        // The one answer that stops a write before it happens has focus —
        // checked before Show all, whose click takes focus for itself.
        await expect(
            prompt.getByRole('button', { name: 'Allow once' })
        ).toBeFocused();

        // Three records, then the rest behind Show all.
        await expect(card).not.toContainText('Our design principles');
        await card.getByRole('button', { name: 'Show all' }).click();
        await expect(card).toContainText('Our design principles');

        await expect(
            prompt.getByRole('button', { name: 'Allow for this chat' })
        ).toBeVisible();
        await expect(
            prompt.getByRole('button', { name: 'Don’t allow' })
        ).toBeVisible();
    });

    test('answers the run with the button pressed', async ({
        page,
        agentsPage
    }) => {
        const spy = await mockCopilotApi(page, { runBody: previewedRun });
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();
        await agentsPage.ask('Write a summary for every article missing one');

        await page.getByRole('button', { name: 'Allow for this chat' }).click();

        await expect.poll(() => spy.decisions.length).toBe(1);
        expect(spy.decisions[0]).toEqual({
            callId: 'call_save',
            decision: 'chat'
        });
    });

    test('without a preview, it says so generically and shows the arguments', async ({
        page,
        agentsPage
    }) => {
        await mockCopilotApi(page, { runBody: parkedRun });
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();
        await agentsPage.ask('Delete the stale draft');

        const prompt = page.getByRole('group', {
            name: 'Ortha CMS AI wants to change your content'
        });
        await expect(prompt).toBeVisible();
        // Never a draft claim it was not told about.
        await expect(prompt).toContainText(
            'Nothing has happened yet — it is waiting for you.'
        );
        await expect(
            prompt
                .getByRole('group', { name: 'What it will send' })
                .or(prompt.getByLabel('What it will send'))
        ).toContainText('"contentType": "article"');
    });

    test('has no accessibility violations with a preview on screen', async ({
        page,
        agentsPage,
        makeAxe
    }) => {
        await mockCopilotApi(page, { runBody: previewedRun });
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();
        await agentsPage.ask('Write a summary for every article missing one');
        await agentsPage.proposalCard(PREVIEW).waitFor();

        await expectNoA11yViolations(makeAxe());
    });
});
