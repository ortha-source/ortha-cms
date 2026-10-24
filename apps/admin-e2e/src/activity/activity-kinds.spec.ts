import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { ALL_KINDS_ACTIVITY, mockActivity } from '../support/api/activity';

/**
 * The kind → sentence catalogue: that **every** audit kind the server writes
 * reads as a localized sentence in the feed, never as its raw wire token.
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
test.describe('Activity kind catalogue', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockActivity(page, ALL_KINDS_ACTIVITY);
    });

    test('every audit kind the server writes reads as a sentence', async ({
        activityLogPage
    }) => {
        // Pin the page size so one render covers every kind in the catalogue
        // (there are more of them than the default page holds).
        await activityLogPage.gotoWith('pageSize=100');
        await expect(activityLogPage.feed).toBeVisible();

        const rows = await activityLogPage.sentences();
        expect(rows.length).toBe(ALL_KINDS_ACTIVITY.length);

        // The raw `domain.action` token leaking through a missing sentence or
        // label is the failure this pins — each row is checked against its own
        // kind, since record names legitimately contain dots ("hero.png").
        const raw = ALL_KINDS_ACTIVITY.filter((seed, index) =>
            rows[index].includes(seed.kind)
        ).map((seed) => seed.kind);
        expect(raw, `kinds rendered raw: ${raw.join(', ')}`).toEqual([]);
    });

    test('a few sentences read as the phrases they should be', async ({
        activityLogPage
    }) => {
        await activityLogPage.gotoWith('pageSize=100');
        await expect(activityLogPage.feed).toBeVisible();

        for (const sentence of [
            'ada@orthacms.dev uploaded hero.png',
            'ada@orthacms.dev deleted a folder',
            'ada@orthacms.dev activated their account',
            'ada@orthacms.dev archived a workspace',
            'ada@orthacms.dev created the workspace Marketing',
            'ada@orthacms.dev shared author',
            'ada@orthacms.dev created the API token CI',
            'The API token CI was used',
            'ada@orthacms.dev created the audience Members',
            'ada@orthacms.dev signed in from 203.0.113.7'
        ]) {
            await expect(activityLogPage.row(sentence)).toHaveCount(1);
        }
    });

    test('the content editing lifecycle reads as what happened, not only publishing', async ({
        activityLogPage
    }) => {
        // Publishing was the only content action the log could answer for:
        // create, edit, delete and restore raised no domain event at all.
        await activityLogPage.gotoWith('pageSize=100');
        await expect(activityLogPage.feed).toBeVisible();

        for (const verb of [
            'created an entry',
            'edited an entry',
            'published an entry',
            'deleted an entry',
            'restored an entry',
            // Its own words, because it is the one content action that leaves
            // nothing behind to inspect afterwards.
            'permanently deleted an entry'
        ]) {
            await expect(activityLogPage.row(verb).first()).toBeVisible();
        }
    });

    test('the home panel names an action the same way the log’s labels do', async ({
        homePage,
        page
    }) => {
        await mockWorkspaces(page);
        await homePage.goto();
        await expect(homePage.activityPanel).toBeVisible();

        // The panel used to show the raw kind, a wire token no locale could
        // translate. Scoped to `main`, since the Recent activity panel is the
        // only place an event kind is rendered on the dashboard.
        const dashboard = page.getByRole('main');
        await expect(dashboard).toContainText('Invited member');
        await expect(dashboard).not.toContainText('user.invited');
    });
});
