import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    LIBRARY_WORKSPACE,
    mockContentSchema,
    mockContentSchemaDetail,
    mockContentEntries,
    mockContentEntryWrites
} from '../support/api/content';

/**
 * The bulk-publish pre-flight dialog's **gated** half — the branch the harness
 * could not reach until now.
 *
 * `mockContentEntryWrites` used to answer every preview row with
 * `verdict: 'publishable'` and `checks: []`. That is precisely the one
 * combination `VerdictRow` renders as an inert line: it gates its whole
 * collapsible on `item.checks.length > 0`, so with an empty checklist there is
 * no disclosure trigger and no blocked styling — the entire checklist UI was
 * unreachable from any browser suite while looking covered.
 *
 * A live stack settles what the mock was guessing at. `POST
 * …/bulk/publish/preview` answers one check per required field on **every**
 * gated verdict (publishable, blocked and already-published alike), each
 * carrying `field`, the human `label`, `ok`, and a `message` when it fails; and
 * `POST …/bulk/publish` reports `skipped` as `{ id, reason }` objects rather
 * than bare ids. Both are pinned server-side in
 * `apps/server-e2e/src/server/content/content-entries-write.spec.ts`; this is
 * the other end of the same contract — that the admin renders what the server
 * actually sends.
 */
test.describe('Bulk publish pre-flight', () => {
    // `product`, not `blog_post`: it declares **two** required fields (`name`
    // and `price`), so a blocked row's checklist carries one failing check and
    // one passing one. A type with a single required field could not tell a
    // renderer that lists the whole gate from one that lists only the
    // failures — the fixture would be too small to distinguish them.
    //
    // Rows are fabricated as `product-01`, `product-02`, … in list order, so the
    // seed names the second as failing `name` and leaves its neighbour passing.
    // Two rows with *different* verdicts is what makes this able to tell a
    // working verdict mapper from one that hard-codes "publishable".
    const BLOCKED_ID = 'product-02';

    test.beforeEach(async ({ page, contentLibraryPage }) => {
        await mockSignedIn(page);
        await mockContentSchema(page);
        await mockContentSchemaDetail(page);
        await mockContentEntries(page);
        await mockContentEntryWrites(page, {
            blocked: { [BLOCKED_ID]: ['name'] }
        });
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);

        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);
        await contentLibraryPage.expandGroup('Collections');
        await contentLibraryPage.typeLink('Products').click();
        await expect(contentLibraryPage.recordsTable('Products')).toBeVisible();

        await contentLibraryPage.rowCheckbox('Products', 0).click();
        await contentLibraryPage.rowCheckbox('Products', 1).click();
        await expect(contentLibraryPage.selectionCount).toHaveText(
            '2 selected'
        );
        await contentLibraryPage.bulkActions.click();
        await contentLibraryPage.bulkAction('Publish').click();
        await expect(contentLibraryPage.bulkPublishDialog).toBeVisible();
    });

    test('tells a blocked row from a publishable one', async ({
        contentLibraryPage
    }) => {
        // The confirm button counts only the publishable row — the whole point
        // of a dry run that reads the server's verdicts rather than the
        // selection size.
        await expect(
            contentLibraryPage.verdictNote('Will publish')
        ).toHaveCount(1);
        await expect(contentLibraryPage.verdictNote('1 issue')).toHaveCount(1);
        await expect(
            contentLibraryPage.bulkPublishDialog.getByRole('button', {
                name: 'Publish 1 valid'
            })
        ).toBeVisible();
    });

    test('expands every gated row to its per-field checklist', async ({
        contentLibraryPage
    }) => {
        // Both rows expand, not just the failing one: a passing row's checklist
        // is "every check, passing", never "no checks". This is the assertion
        // the old `checks: []` seed made impossible — it rendered no trigger at
        // all, so the count here was zero for every suite.
        await expect(contentLibraryPage.verdictCheckToggles).toHaveCount(2);

        // The blocked row lists the failing field by its **label** ('Name',
        // the admin label the server sends) with the reason appended, and the
        // field that passed alongside it — the whole gate, not only what is
        // wrong. Asserting the full list rather than one line is what stops a
        // renderer that dropped the passing checks from reading as green.
        await contentLibraryPage.verdictCheckToggles.nth(1).click();
        await expect(contentLibraryPage.verdictChecks(1)).toHaveText([
            'Name: is required',
            'Price'
        ]);
    });

    test('publishes only the valid rows and reports the count', async ({
        page,
        contentLibraryPage
    }) => {
        await contentLibraryPage.bulkPublishDialog
            .getByRole('button', { name: 'Publish 1 valid' })
            .click();

        // The dialog closes and the outcome lands in a toast. The commit's
        // `skipped` carries `{ id, reason }` objects while `published` carries
        // ids; the count comes from the latter, so a response that conflated
        // the two shapes would over-report here.
        await expect(page.getByText('1 record published.')).toBeVisible();
        await expect(contentLibraryPage.bulkPublishDialog).toBeHidden();
    });
});
