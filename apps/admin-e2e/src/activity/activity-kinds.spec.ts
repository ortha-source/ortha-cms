import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { ALL_KINDS_ACTIVITY, mockActivity } from '../support/api/activity';

/**
 * The kind → label catalogue: that **every** audit kind the server writes has a
 * localized Action label in the admin, and every `subjectType` a readable name.
 *
 * This suite exists because the failure mode it guards is silent. The admin
 * restates the server's kind strings locally (it cannot import the server
 * plugins), the mapper casts `dto.kind as ActivityKind` without checking, and a
 * kind with no descriptor falls back to printing the raw dotted wire token. No
 * type error, no runtime error, no failing test — just `media.asset.uploaded`
 * rendered literally on the page whose job is being the record of record, for as
 * long as nobody looks. Six `workspace.*` kinds, `user.activated` and all seven
 * `media.*` kinds shipped that way.
 *
 * `ALL_KINDS_ACTIVITY` is the pin: keep it in step with the server's
 * `FACET_MAPPERS` and these tests fail the moment the admin falls behind again.
 */
test.describe('Activity Log kind catalogue', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockActivity(page, ALL_KINDS_ACTIVITY);
    });

    test('every audit kind the server writes has a localized Action label', async ({
        activityLogPage
    }) => {
        // Pin the page size so one render covers every kind in the catalogue
        // (there are more of them than the default page holds).
        await activityLogPage.gotoWith('pageSize=100');
        await expect(activityLogPage.table).toBeVisible();

        const labels = await activityLogPage.actionLabels();
        expect(labels.length).toBe(ALL_KINDS_ACTIVITY.length);

        // A dot is the signature of the raw `domain.action` wire token leaking
        // through the label lookup's fallback.
        const raw = labels.filter((label) => label.includes('.'));
        expect(raw, `unlabelled kinds: ${raw.join(', ')}`).toEqual([]);
    });

    test('a few labels read as the phrases they should be', async ({
        activityLogPage
    }) => {
        await activityLogPage.gotoWith('pageSize=100');
        // Wait for the real table: the pending skeleton is also a <table> with
        // eight blank rows, so reading cells too early yields eight empty
        // strings and every `toContain` fails for the wrong reason.
        await expect(activityLogPage.table).toBeVisible();
        const labels = await activityLogPage.actionLabels();

        expect(labels).toContain('Uploaded asset');
        expect(labels).toContain('Deleted folder');
        expect(labels).toContain('Activated account');
        expect(labels).toContain('Archived workspace');
        expect(labels).toContain('Granted content access');
    });

    test('every subject type renders as a readable name, not a machine token', async ({
        activityLogPage
    }) => {
        await activityLogPage.gotoWith('pageSize=100');
        await expect(activityLogPage.table).toBeVisible();
        const types = await activityLogPage.subjectTypeLabels();

        // `capitalize` on a snake_cased token gives "Media_asset".
        const tokens = types.filter((type) => type.includes('_'));
        expect(tokens, `raw subject types: ${tokens.join(', ')}`).toEqual([]);

        expect(types).toContain('Media asset');
        expect(types).toContain('Media folder');
        expect(types).toContain('Content entry');
        expect(types).toContain('API token');
    });

    test('the Details line reads the per-kind meta the server records', async ({
        activityLogPage,
        page
    }) => {
        await activityLogPage.gotoWith('pageSize=100');

        // A rename records `{ name: { from, to } }`; this used to render the
        // constant "Name changed" and ignore the payload entirely.
        await activityLogPage.expandRow('Updated profile');
        await expect(page.getByText('Ada L → Ada B')).toBeVisible();

        // Media payloads differ per kind by design, so each reads one field.
        await activityLogPage.expandRow('Uploaded asset');
        await expect(page.getByText('hero.png').first()).toBeVisible();

        // An entry edit names the fields it changed, the same shape a workspace
        // update uses — the difference between "someone saved this" and a row a
        // reviewer can act on.
        await activityLogPage.expandRow('Edited content');
        await expect(page.getByText('title, body').first()).toBeVisible();
    });

    test('the content editing lifecycle is labelled, not only publishing', async ({
        activityLogPage
    }) => {
        // Publishing was the only content action the log could answer for:
        // create, edit, delete and restore raised no domain event at all, so an
        // editor could rewrite the whole product and the record of record
        // stayed silent about the most frequent action in a CMS.
        await activityLogPage.gotoWith('pageSize=100');
        await expect(activityLogPage.table).toBeVisible();
        const labels = await activityLogPage.actionLabels();

        expect(labels).toContain('Created content');
        expect(labels).toContain('Edited content');
        expect(labels).toContain('Deleted content');
        expect(labels).toContain('Restored content');
        // Its own label, because it is the one content action that leaves
        // nothing behind to inspect afterwards.
        expect(labels).toContain('Permanently deleted content');
    });

    test('the home panel names an action the same way the table does', async ({
        homePage,
        page
    }) => {
        await mockWorkspaces(page);
        await homePage.goto();
        await expect(homePage.activityPanel).toBeVisible();

        // The panel used to show the raw kind while the table showed a label,
        // so the two surfaces named the same event differently — and the
        // panel's half was a wire token no `react-intl` locale could translate.
        // Scoped to `main`, since the Recent activity panel is the only place
        // an event kind is rendered on the dashboard.
        const dashboard = page.getByRole('main');
        await expect(dashboard).toContainText('Invited member');
        await expect(dashboard).not.toContainText('user.invited');
    });
});
