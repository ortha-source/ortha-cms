import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    RELATIONS_WORKSPACE,
    RELATIONS_SCHEMA_SEED,
    RELATIONS_DETAIL_SEED,
    RELATIONS_ENTRIES_SEED,
    mockContentSchema,
    mockContentSchemaDetail,
    mockContentEntries
} from '../support/api/content';

/** The records-table URL for the relations suite's `article` collection. */
const ARTICLES_URL = `/workspaces/${RELATIONS_WORKSPACE.id}/content/article`;

/**
 * The article detail with a **boolean** and a **date** field bolted on.
 *
 * The shared seed is all text and relations, and the two defects this suite
 * pins are per-type: a boolean whose value the `Select` editor cannot produce,
 * and a date whose column no substring operator can be run against. Extending
 * locally rather than editing `RELATIONS_DETAIL_SEED` keeps every other suite's
 * column count where it was.
 */
const DETAIL_SEED = {
    ...RELATIONS_DETAIL_SEED,
    article: {
        ...RELATIONS_DETAIL_SEED.article,
        fields: [
            ...RELATIONS_DETAIL_SEED.article.fields,
            {
                name: 'featured',
                type: 'boolean' as const,
                required: false,
                validation: {},
                admin: { label: 'Featured' }
            },
            {
                name: 'embargoUntil',
                type: 'datetime' as const,
                required: false,
                validation: {},
                admin: { label: 'Embargo until' }
            }
        ]
    }
};

/** `?filter=` for one hand-written leaf rule, encoded the way a link would be. */
function filterUrl(rule: Record<string, unknown>): string {
    return `${ARTICLES_URL}?filter=${encodeURIComponent(JSON.stringify(rule))}`;
}

/**
 * The **deserialiser's tolerance contract**: `?filter=` is a public, hand-
 * editable, shareable surface, and `jsonFilterToTree` promises to drop anything
 * it does not recognise rather than let it through.
 *
 * Every case here arrives by URL, because that is the only way to reach these
 * states — the pickers cannot author any of them. Which is precisely why none
 * of them had cover: the existing filter suites all drive the builder through
 * its own UI, so they only ever produce rules the builder considers legal.
 */
test.describe('Records filter — hand-edited ?filter=', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [RELATIONS_WORKSPACE]);
        await mockContentSchema(page, { types: RELATIONS_SCHEMA_SEED });
        await mockContentSchemaDetail(page, { details: DETAIL_SEED });
        await mockContentEntries(page, {
            details: DETAIL_SEED,
            entries: RELATIONS_ENTRIES_SEED
        });
    });

    /**
     * `WIRE_TO_UI` is a plain object literal, so a bare
     * `WIRE_TO_UI[wireOp] ?? null` answered `constructor` with `Object` —
     * truthy — and the guard the whole contract rests on never fired. The rule
     * that came back carried a *function* as its operator, and the first
     * component to format it threw. The page-level boundary caught it, which is
     * the observable: the records table is gone and "Something went wrong" is
     * all that is left.
     */
    for (const op of ['constructor', 'toString', 'valueOf', '__proto__']) {
        test(`an "${op}" operator is dropped, not rendered`, async ({
            contentLibraryPage,
            page
        }) => {
            await page.goto(filterUrl({ field: 'text', op, value: 'x' }));

            // The page still works. Asserted first and positively: the failure
            // this guards is the whole view being replaced.
            await expect(
                contentLibraryPage.recordsTable('Articles')
            ).toBeVisible();
            await expect(
                page.getByRole('heading', { name: 'Something went wrong' })
            ).toBeHidden();

            // And the rule really was dropped rather than merely surviving
            // render — no condition reaches the collapsed summary.
            await expect(
                page.getByRole('button', { name: 'Clear all' })
            ).toBeHidden();
        });
    }

    /**
     * `contains` is not among the operators an enum offers, so no picker can
     * produce this rule — but nothing stopped a URL from carrying it, and
     * `validateRule` only ever checked the *value*. The operator cell renders
     * blank (the `Select` has no matching item), so without an error the row
     * reads as an unfinished draft rather than a broken rule. Hence the error
     * shows unconditionally, before any Apply.
     */
    test('an operator the field does not offer is reported without pressing Apply', async ({
        contentLibraryPage,
        page
    }) => {
        await page.goto(
            filterUrl({ field: 'status', op: 'ilike', value: '%draft%' })
        );
        await expect(contentLibraryPage.recordsTable('Articles')).toBeVisible();
        await contentLibraryPage.openFilters();

        await expect(contentLibraryPage.ruleError()).toContainText(
            'This operator does not apply to this field'
        );
    });

    /**
     * …and the Apply gate refuses it. The serialiser would happily have written
     * `ilike` against a `timestamptz`, which Postgres has no operator for — the
     * server answers that with a 500, not a validation error, so the user gets
     * "couldn't load this collection" over a filter the drawer agreed to send.
     */
    test('the Apply gate refuses a substring operator on a date field', async ({
        contentLibraryPage,
        page
    }) => {
        const crafted = filterUrl({
            field: 'embargoUntil',
            op: 'ilike',
            value: '%2020%'
        });
        await page.goto(crafted);
        await expect(contentLibraryPage.recordsTable('Articles')).toBeVisible();
        await contentLibraryPage.openFilters();
        await contentLibraryPage.applyFilters();

        // Apply is a no-op: the URL keeps the hand-written single-rule shape
        // instead of gaining the `{"and":[…]}` wrapper a commit writes.
        await expect(page).not.toHaveURL(/%22and%22/);
        await expect(contentLibraryPage.ruleError()).toBeVisible();
    });

    /**
     * A boolean has exactly two legal values and the editor is a `Select` over
     * both, so `"yes"` can only arrive by URL. The scalar check knew it was
     * invalid and then fell through the code ladder without returning one, so
     * the gate passed it and the request 400d.
     */
    test('the Apply gate refuses a non-boolean value on a boolean field', async ({
        contentLibraryPage,
        page
    }) => {
        await page.goto(
            filterUrl({ field: 'featured', op: 'eq', value: 'yes' })
        );
        await expect(contentLibraryPage.recordsTable('Articles')).toBeVisible();
        await contentLibraryPage.openFilters();
        await contentLibraryPage.applyFilters();

        await expect(page).not.toHaveURL(/%22and%22/);
        await expect(contentLibraryPage.ruleError()).toContainText(
            'Must be true or false'
        );
    });

    /**
     * A well-formed rule still round-trips. Without this the four cases above
     * would all pass on a deserialiser that returned `null` for everything.
     */
    test('a legal hand-written rule still restores and commits', async ({
        contentLibraryPage,
        page
    }) => {
        await page.goto(
            filterUrl({ field: 'text', op: 'ilike', value: '%Ada%' })
        );
        await expect(contentLibraryPage.recordsTable('Articles')).toBeVisible();
        await contentLibraryPage.openFilters();

        await expect(contentLibraryPage.ruleError()).toBeHidden();
        await contentLibraryPage.applyFilters();
        await expect(page).toHaveURL(/%22and%22/);
    });

    /**
     * The JSON preview serialises the **live draft**, in the component body,
     * so it runs on every keystroke whether or not the preview is expanded. A
     * count large enough to push the cutoff past the instants `Date` can hold
     * therefore threw `RangeError` mid-typing — the panel died under the user's
     * cursor, with the number half-entered.
     */
    test('a huge "within the last" count is clamped instead of crashing the panel', async ({
        contentLibraryPage,
        page
    }) => {
        await page.goto(ARTICLES_URL);
        await expect(contentLibraryPage.recordsTable('Articles')).toBeVisible();

        await contentLibraryPage.openFilters();
        await contentLibraryPage.addRule();
        await contentLibraryPage.selectField('Embargo until');
        await contentLibraryPage.selectOperatorExact('within the last');

        const amount = contentLibraryPage
            .filterSurface()
            .getByLabel('Amount', { exact: true });
        await amount.fill('99999999999');

        await expect(
            page.getByRole('heading', { name: 'Something went wrong' })
        ).toBeHidden();
        await expect(contentLibraryPage.filterSurface()).toBeVisible();
        // Clamped in the editor, so the model never holds the unrepresentable
        // window in the first place.
        await expect(amount).toHaveValue('100000');
    });
});
