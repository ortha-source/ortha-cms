import { expect, test } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockContentSchema } from '../support/api/content';
import { mockCopilotApi, USAGE_RESETS_AT } from '../support/api/copilot';

const WORKSPACE_ID = 'ws_marketing';

/**
 * The usage meter under the composer, and what the panel says when a usage
 * limit refuses a run.
 *
 * The limits themselves — the ledger, the locks, the 429 — are `server-e2e`'s
 * `copilot-quotas` suite against a real database. What only a browser can
 * answer is what a person sees: no meter when no quota applies, the figure
 * and the warning in words, a box that refuses to send once the allowance is
 * spent (and keeps the text), and a refusal worded from its code rather than
 * from the server's English.
 */
test.describe('Agents view — usage limits', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
        await mockContentSchema(page);
    });

    // Every deployment that has not configured a quota: nothing changes.
    test('draws no meter when no quota applies', async ({
        page,
        agentsPage
    }) => {
        await mockCopilotApi(page);
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        await expect(agentsPage.composer()).toBeVisible();
        await expect(agentsPage.usageMeter()).toHaveCount(0);
    });

    test('says today’s spend in words, not only as a bar', async ({
        page,
        agentsPage
    }) => {
        await mockCopilotApi(page, {
            usage: { used: 1_240_000, limit: 2_000_000 }
        });
        await agentsPage.goto(WORKSPACE_ID);

        const meter = agentsPage.usageMeter();
        await expect(meter).toHaveAttribute('aria-valuenow', '1240000');
        await expect(meter).toHaveAttribute('aria-valuemax', '2000000');
        await expect(meter).toHaveAttribute(
            'aria-valuetext',
            '1.2M of 2M tokens today'
        );
        await expect(agentsPage.sendButton()).toBeVisible();
    });

    test('warns with what is left from 80%', async ({ page, agentsPage }) => {
        await mockCopilotApi(page, {
            usage: { used: 1_700_000, limit: 2_000_000 }
        });
        await agentsPage.goto(WORKSPACE_ID);

        await expect(agentsPage.usageMeter()).toHaveAttribute(
            'aria-valuetext',
            '300K tokens left today'
        );
    });

    // The server would refuse with a 429; the box refuses first, says until
    // when through its live region, and keeps what was typed.
    test('refuses to send once the allowance is spent, keeping the text', async ({
        page,
        agentsPage
    }) => {
        const spy = await mockCopilotApi(page, {
            usage: { used: 2_000_000, limit: 2_000_000 }
        });
        await agentsPage.goto(WORKSPACE_ID);
        await expect(agentsPage.usageMeter()).toHaveAttribute(
            'aria-valuetext',
            'Today’s allowance is used up'
        );

        await agentsPage.ask('Summarise the launch posts');

        await expect(agentsPage.composerHint()).toContainText(
            'You can send again at'
        );
        await expect(agentsPage.composer()).toHaveValue(
            'Summarise the launch posts'
        );
        expect(spy.runs).toHaveLength(0);
    });

    test('says so when the workspace’s allowance is spent', async ({
        page,
        agentsPage
    }) => {
        await mockCopilotApi(page, {
            usage: { used: 10, limit: null, workspaceExhausted: true }
        });
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        await agentsPage.composer().fill('Anything');
        await expect(agentsPage.composerHint()).toContainText(
            'This workspace has used today’s Ortha CMS AI allowance'
        );
        await expect(agentsPage.sendButton()).toBeDisabled();
    });

    // Worded from `code`, with the wait the server named.
    test('words a rate-limit refusal from its code', async ({
        page,
        agentsPage
    }) => {
        await mockCopilotApi(page, {
            runRefusal: {
                code: 'copilot.rate_limited',
                scope: 'user',
                retryAfterSeconds: 20
            }
        });
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        await agentsPage.ask('Hello');

        await expect(
            agentsPage.turnAlert('Too many requests. Try again in 20 seconds.')
        ).toBeVisible();
    });

    test('words a quota refusal with the reset time', async ({
        page,
        agentsPage
    }) => {
        await mockCopilotApi(page, {
            runRefusal: {
                code: 'copilot.quota_exceeded',
                scope: 'workspace',
                resetsAt: USAGE_RESETS_AT,
                retryAfterSeconds: 3600
            }
        });
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        await agentsPage.ask('Hello');

        await expect(
            agentsPage.turnAlert(
                /This workspace has used today’s Ortha CMS AI allowance\. It resets at/
            )
        ).toBeVisible();
    });

    test('has no axe violations with the allowance nearly spent', async ({
        page,
        agentsPage,
        makeAxe
    }) => {
        await mockCopilotApi(page, {
            usage: { used: 1_700_000, limit: 2_000_000 }
        });
        await agentsPage.goto(WORKSPACE_ID);
        await expect(agentsPage.usageMeter()).toBeVisible();

        const results = await makeAxe().analyze();
        expect(results.violations).toEqual([]);
    });

    test('has no axe violations with the allowance spent', async ({
        page,
        agentsPage,
        makeAxe
    }) => {
        await mockCopilotApi(page, {
            usage: { used: 2_000_000, limit: 2_000_000 }
        });
        await agentsPage.goto(WORKSPACE_ID);
        await expect(agentsPage.usageMeter()).toBeVisible();

        const results = await makeAxe().analyze();
        expect(results.violations).toEqual([]);
    });
});
