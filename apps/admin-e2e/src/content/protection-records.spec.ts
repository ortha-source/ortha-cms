import { test, expect } from '../support/fixtures';
import { expectNoA11yViolations } from '../support/a11y';
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
import {
    mockEntryReview,
    mockReviewStatusByEntry
} from '../support/api/protection';

const WS = LIBRARY_WORKSPACE.id;
const TYPE = 'blog_post';
const TABLE = 'Blog posts';
/** The column's header text, and therefore how its cells are located. */
const COLUMN = 'Review';

/**
 * The **Review column** in the records list.
 *
 * Its unit specs cover the five states and their accessible names. What only a
 * browser can answer is the half that has no pixels: an extension column is
 * hidden by default and its `useRowsData` hook runs anyway — it has to, since
 * skipping it would change React's hook order between renders — so the one
 * thing standing between a hidden column and a batched request on every page of
 * every list is `isVisible` reaching the query's `enabled`. Nothing on screen
 * shows whether it did.
 *
 * The same argument the alarms suite makes for its Checks column, and the
 * reason this file exists at all: #263 shipped the column with unit coverage
 * and no browser test, which leaves that contract unpinned.
 */
test.describe('The Review column in the records list', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await mockContentSchema(page);
        await mockContentSchemaDetail(page);
        await mockContentEntries(page);
        await mockContentEntryWrites(page);
        await mockEntryRelations(page);
        // Registered before the status route on purpose: this one claims
        // `…/entries/**`, which also matches `…/entries/:type/status`, and the
        // last route registered wins.
        await mockEntryReview(page);
    });

    test('asks for nothing while it is hidden, then once for the page', async ({
        page,
        contentLibraryPage
    }) => {
        const api = await mockReviewStatusByEntry(page, {});
        await contentLibraryPage.gotoRecords(WS, TYPE);
        await expect(contentLibraryPage.recordRows(TABLE)).toHaveCount(10);

        expect(api.requests).toEqual([]);

        // A second page, because "off" has to mean off everywhere — a hook
        // ignoring `isVisible` would fire once per page of every list. Paging
        // also settles the first page's effects, so a request queued there
        // would already be recorded. Activated from the keyboard: the copilot
        // dock is `fixed bottom-3 right-4` and floats over the records footer.
        await contentLibraryPage.nextPage.focus();
        await page.keyboard.press('Enter');
        await expect(contentLibraryPage.pageReadout).toHaveText('Page 2 of 3');
        expect(api.requests).toEqual([]);

        await contentLibraryPage.showColumn(COLUMN);

        await expect.poll(() => api.requests.length, { timeout: 5000 }).toBe(1);
        // One request carrying the whole page, not one request per row.
        expect(api.requests[0].split(',')).toHaveLength(10);
    });

    /**
     * Four answers an empty cell would flatten into one, and only two of them
     * mean anybody has to do anything.
     */
    test('tells blocked, ready, not-requested and unprotected apart', async ({
        page,
        contentLibraryPage
    }) => {
        await mockReviewStatusByEntry(page, {
            'blog_post-01': { required: 2, given: 1, requested: true },
            'blog_post-02': { required: 2, given: 2, blocked: false },
            'blog_post-03': { required: 2, given: 0, requested: false },
            'blog_post-04': { protected: false, required: 0, blocked: false }
        });
        await contentLibraryPage.gotoRecords(WS, TYPE);
        await contentLibraryPage.showColumn(COLUMN);

        const cells = await contentLibraryPage.columnCells(TABLE, COLUMN);
        await expect(cells.first()).toContainText('1 of 2');
        await expect(cells.nth(1)).toContainText('Ready');
        await expect(cells.nth(2)).toContainText('Not requested');
        await expect(cells.nth(3)).toContainText('No review');
    });

    /**
     * The count is the visible half; the sentence is the fact. A cell reading
     * "1 of 2" beside a title says nothing to somebody who cannot see the
     * column header it sits under.
     */
    test('every cell says what its number means, not just the number', async ({
        page,
        contentLibraryPage
    }) => {
        await mockReviewStatusByEntry(page, {
            'blog_post-01': { required: 2, given: 1, requested: true }
        });
        await contentLibraryPage.gotoRecords(WS, TYPE);
        await contentLibraryPage.showColumn(COLUMN);

        // Located by the record as the reader sees it: the status map is keyed
        // on the entry id, but the row shows a title.
        const cell = await contentLibraryPage.columnCellIn(
            TABLE,
            COLUMN,
            'Title 01'
        );
        const labelled = cell.locator('[aria-label]').first();
        await expect(labelled).toHaveAttribute(
            'aria-label',
            /approval|review/i
        );
    });

    /**
     * A failed read is not "no review needed". Telling somebody their record
     * needs nothing when the truth is that the answer could not be fetched is
     * the one wrong answer this cell can give — a 403 rather than a 500 so the
     * shared client settles immediately instead of walking its retry ladder.
     */
    test('a failed read does not read as an unprotected record', async ({
        page,
        contentLibraryPage
    }) => {
        await mockReviewStatusByEntry(page, {}, { status: 403 });
        await contentLibraryPage.gotoRecords(WS, TYPE);
        await contentLibraryPage.showColumn(COLUMN);

        const cells = await contentLibraryPage.columnCells(TABLE, COLUMN);
        await expect(cells.first()).not.toContainText('No review');
        await expect(cells.first()).not.toContainText('Ready');
    });

    test('has no accessibility violations with the column on', async ({
        page,
        contentLibraryPage,
        makeAxe
    }) => {
        await mockReviewStatusByEntry(page, {
            'blog_post-01': { required: 2, given: 1, requested: true },
            'blog_post-02': { required: 2, given: 2, blocked: false }
        });
        await contentLibraryPage.gotoRecords(WS, TYPE);
        await contentLibraryPage.showColumn(COLUMN);
        await expect(
            (await contentLibraryPage.columnCells(TABLE, COLUMN)).first()
        ).toContainText('1 of 2');

        await expectNoA11yViolations(makeAxe());
    });
});
