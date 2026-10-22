import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    LIBRARY_WORKSPACE,
    mockContentSchema,
    mockContentSchemaDetail,
    mockContentEntries,
    mockContentEntryWrites,
    mockEntryRelations
} from '../support/api/content';
import { mockEntryActivity } from '../support/api/activity';

/** A seeded blog post to open the editor on (`entriesFor` numbers them). */
const ENTRY_ID = 'blog_post-01';

/**
 * The record's **activity** in the entry editor — since ADR-0022, rows of the
 * History timeline picked out by its Activity filter, rather than a tab of
 * its own beside History (two timelines of one record asked the reader to
 * merge them in their head). Before that it was a tab (ORT-198), and before
 * that a section of the Properties rail.
 *
 * The rows read `GET /activity/entries/:id`, gated `content:read` rather than
 * the admin-only `activity:read` that guards the deployment-wide log.
 */
test.describe('Entry activity in History', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await mockContentSchema(page);
        await mockContentSchemaDetail(page);
        await mockContentEntries(page);
        await mockContentEntryWrites(page);
        await mockEntryRelations(page);
    });

    test('lists what happened to the record, actors and all', async ({
        page,
        contentLibraryPage
    }) => {
        await mockEntryActivity(page);
        await contentLibraryPage.gotoEntry(
            LIBRARY_WORKSPACE.id,
            'blog_post',
            ENTRY_ID
        );

        await contentLibraryPage.showHistory('Activity');

        await expect(page.getByText('Published content')).toBeVisible();
        await expect(page.getByText('Edited content')).toBeVisible();
        await expect(page.getByText('ada@orthacms.dev')).toBeVisible();
        // An event nobody performed reads as "System", not as a blank actor.
        await expect(page.getByText('System', { exact: true })).toBeVisible();
        await expect(
            contentLibraryPage.historyFilter('Activity')
        ).toHaveAttribute('aria-checked', 'true');
    });

    test('the retired /activity link lands on History showing activity [content:I-60]', async ({
        page,
        contentLibraryPage
    }) => {
        await mockEntryActivity(page);
        await page.goto(
            `/workspaces/${LIBRARY_WORKSPACE.id}/content/blog_post/${ENTRY_ID}/activity`
        );

        await expect(page).toHaveURL(/\/history\?show=activity$/);
        await expect(contentLibraryPage.editorTab('History')).toHaveAttribute(
            'aria-selected',
            'true'
        );
        await expect(page.getByText('Published content')).toBeVisible();
    });

    test('does not fetch a history for a record that has none yet', async ({
        page,
        contentLibraryPage
    }) => {
        let asked = false;
        await page.route('**/api/activity/entries/*', async (route) => {
            asked = true;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    items: [],
                    total: 0,
                    page: 1,
                    pageSize: 25
                })
            });
        });

        await page.goto(
            `/workspaces/${LIBRARY_WORKSPACE.id}/content/blog_post/new`
        );
        await contentLibraryPage.openEditorTab('History');

        // History explains itself rather than showing an empty list — and asks
        // the API nothing, because an unsaved record has no id to ask about.
        await expect(
            page.getByText('Save this record to start its version history.')
        ).toBeVisible();
        await expect(contentLibraryPage.historyFilter('Activity')).toHaveCount(
            0
        );
        expect(asked).toBe(false);
    });

    /**
     * "Nothing happened" and "we could not find out" read identically on
     * screen, and only one of them is a fact — so a failed load must not
     * render as the empty state.
     */
    test('says the activity could not be loaded rather than showing it empty', async ({
        page,
        contentLibraryPage
    }) => {
        await mockEntryActivity(page, [], { status: 500 });
        await contentLibraryPage.gotoEntry(
            LIBRARY_WORKSPACE.id,
            'blog_post',
            ENTRY_ID
        );

        await contentLibraryPage.showHistory('Activity');

        // A 5xx takes TanStack Query's full retry ladder before `isError`.
        await expect(
            page.getByText('Activity could not be loaded')
        ).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText('Nothing has been recorded')).toHaveCount(
            0
        );
    });
});
