import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockActivity, mockDeadLetters } from '../support/api/activity';
import { mockWebhooksApi } from '../support/api/webhooks';
import { mockAlarmSummary } from '../support/api/alarms';
import { mockReviewQueue } from '../support/api/protection';

/**
 * The Home dashboard (`/`, from `@orthacms/shell-admin`). The greeting is the
 * shell's; the stat tiles + Workspaces panel are contributed by
 * `workspaces-admin` and the Recent activity panel by `activity-admin`, both via
 * the `HOME_SECTION_SLOT`; the attention cards come from `webhooks-admin`
 * (stopped endpoints) and `activity-admin` (dead letters), the top-bar actions
 * from `users-admin` and `workspaces-admin`. Data is real: workspaces from
 * `GET /api/workspaces`, events from `GET /api/activity` (stubbed here).
 */
test.describe('Home dashboard', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page, {
            name: 'Amara Okafor',
            email: 'amara@orthacms.dev'
        });
        await mockWorkspaces(page);
        await mockActivity(page);
    });

    test('shows the greeting, stat tiles, and both panels', async ({
        homePage
    }) => {
        await homePage.goto();

        await expect(homePage.heading).toContainText('Amara Okafor');
        await expect(homePage.statTile('Active workspaces')).toBeVisible();
        await expect(homePage.statTile('Members')).toBeVisible();
        await expect(homePage.statTile('Content types')).toBeVisible();
        await expect(homePage.workspacesPanel).toBeVisible();
        await expect(homePage.activityPanel).toBeVisible();
    });

    test('the panels link through to their full pages', async ({
        homePage,
        page
    }) => {
        await homePage.goto();

        // Two "View all" links — one per panel (Workspaces, Recent activity).
        await expect(page.getByRole('link', { name: 'View all' })).toHaveCount(
            2
        );
    });

    test('the top bar carries the create actions', async ({ homePage }) => {
        await homePage.goto();

        await expect(homePage.topBarAction('Invite member')).toHaveAttribute(
            'href',
            '/users/invite'
        );
        await expect(homePage.topBarAction('New workspace')).toHaveAttribute(
            'href',
            '/workspaces/new'
        );
    });

    test('says nothing needs attention while nothing does', async ({
        homePage,
        page
    }) => {
        await mockWebhooksApi(page, { endpoints: [] });
        await mockDeadLetters(page, []);
        await homePage.goto();

        await expect(homePage.workspacesPanel).toBeVisible();
        await expect(homePage.attention).toBeHidden();
    });

    test('a stopped webhook and unrecorded actions each get a card', async ({
        homePage,
        page
    }) => {
        await mockWebhooksApi(page);
        await mockDeadLetters(page);
        await homePage.goto();

        await expect(homePage.attention).toBeVisible();
        const webhook = homePage.attentionCard(/1 webhook stopped/);
        await expect(webhook).toHaveAttribute('href', '/webhooks/wh_broken');
        await expect(webhook).toContainText('Old staging preview');
        await expect(homePage.attentionCard(/not recorded/)).toHaveAttribute(
            'href',
            '/activity'
        );
    });

    test('alarms and reviews say 0 rather than disappearing', async ({
        homePage,
        page
    }) => {
        await mockAlarmSummary(page);
        await mockReviewQueue(page, []);
        await homePage.goto();

        await expect(homePage.attention).toBeVisible();
        await expect(homePage.attentionCard(/0 open findings/)).toContainText(
            'Every alarm check passes'
        );
        await expect(
            homePage.attentionCard(/0 entries await review/)
        ).toContainText('Nothing is waiting on a reviewer');
    });

    test('open findings are counted across workspaces and lead to them', async ({
        homePage,
        page
    }) => {
        // Home sits outside every workspace, so it asks each one by header.
        await mockAlarmSummary(page, { ws_marketing: 3 });
        await homePage.goto();

        const card = homePage.attentionCard(/3 open findings/);
        await expect(card).toHaveAttribute(
            'href',
            '/workspaces/ws_marketing/alarms'
        );
        await expect(card).toContainText('Marketing site (3)');
    });
});
