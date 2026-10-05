import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { expectNoA11yViolations } from '../support/a11y';
import type { ContentLibraryPage } from '../support/pages/ContentLibraryPage';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    RELATION_AUTHOR_IDS,
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
 * The records-table **filter popover** (`@orthacms/query-builder-admin`) over a
 * collection with **relations** (`article` → `author`). This is the admin-side
 * wiring for relation filtering: the field picker (now a searchable, grouped
 * `Command`) offers a related type's fields under a breadcrumb, and applying a
 * rule on `author.name` deep-links the dotted path into `?filter=`.
 *
 * Backend semantics (that the path actually narrows rows, excludes soft-deleted
 * / cross-workspace targets) live in `server-e2e`'s relation-filter suite — the
 * `/api` layer is mocked here, so this asserts the UI contract only. The
 * `filter-fields` surface is served by `mockContentSchemaDetail`.
 */
test.describe('Records filter — relations (query builder)', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [RELATIONS_WORKSPACE]);
        await mockContentSchema(page, { types: RELATIONS_SCHEMA_SEED });
        await mockContentSchemaDetail(page, { details: RELATIONS_DETAIL_SEED });
        await mockContentEntries(page, {
            details: RELATIONS_DETAIL_SEED,
            entries: RELATIONS_ENTRIES_SEED
        });
    });

    /**
     * The surface itself: an icon-only trigger, a popover anchored to it, and
     * the builder's own nested overlays layered over that popover. The nested
     * pickers portal to `<body>` — outside the popover's DOM — so "clicking
     * in them does not dismiss it" and "their lists still wheel" are claims
     * about layering and scroll locking that only a real browser can check.
     */
    test.describe('the filters popover', () => {
        test('Columns and Filters are named icon buttons with a tooltip', async ({
            contentLibraryPage,
            page
        }) => {
            await page.goto(ARTICLES_URL);
            await expect(
                contentLibraryPage.recordsTable('Articles')
            ).toBeVisible();

            await expect(contentLibraryPage.columnsButton).toHaveAccessibleName(
                'Columns'
            );
            await expect(
                contentLibraryPage.filterTrigger()
            ).toHaveAccessibleName('Filters');
            // The tooltip opens on keyboard focus, not only on hover (1.4.13),
            // and describes the trigger while it is up.
            await contentLibraryPage.filterTrigger().focus();
            await expect(
                contentLibraryPage.filterTrigger()
            ).toHaveAccessibleDescription('Filters');
            await contentLibraryPage.columnsButton.focus();
            await expect(
                contentLibraryPage.columnsButton
            ).toHaveAccessibleDescription('Columns');
        });

        test('opens from the keyboard with focus inside, and Escape hands it back', async ({
            contentLibraryPage,
            page
        }) => {
            await page.goto(ARTICLES_URL);
            await expect(
                contentLibraryPage.recordsTable('Articles')
            ).toBeVisible();

            await contentLibraryPage.filterTrigger().focus();
            await page.keyboard.press('Enter');
            await expect(contentLibraryPage.filterTrigger()).toHaveAttribute(
                'aria-expanded',
                'true'
            );
            await expect(contentLibraryPage.filterSurface()).toBeVisible();
            // No conditions yet, so the first thing to do is add one.
            await expect(contentLibraryPage.addRuleControl()).toBeFocused();

            await page.keyboard.press('Escape');
            await expect(contentLibraryPage.filterTrigger()).toHaveAttribute(
                'aria-expanded',
                'false'
            );
            await expect(contentLibraryPage.filterSurface()).toBeHidden();
            await expect(contentLibraryPage.filterTrigger()).toBeFocused();
        });

        test('the field picker works inside it — no dismissal, and its list wheels', async ({
            contentLibraryPage,
            page
        }) => {
            await page.goto(ARTICLES_URL);
            await expect(
                contentLibraryPage.recordsTable('Articles')
            ).toBeVisible();

            await contentLibraryPage.openFilters();
            await contentLibraryPage.addRule();
            await contentLibraryPage.openFieldPicker();
            // Clicks inside the nested picker: each expands a relation, and
            // none of them may read as a click outside the filters popover.
            await contentLibraryPage.expandFieldPickerRelation('Author');
            await contentLibraryPage.expandFieldPickerRelation('SEO metadata');
            await contentLibraryPage.expandFieldPickerRelation('Tags');
            await expect(contentLibraryPage.filterSurface()).toBeVisible();

            // The list now overflows; the wheel must move it. A scroll lock on
            // the filters popover would let it drag but never wheel.
            const before = await contentLibraryPage.fieldPickerScroll();
            expect(before.scroll).toBeGreaterThan(before.client);
            await contentLibraryPage.wheelFieldPicker(200);
            await expect
                .poll(
                    async () =>
                        (await contentLibraryPage.fieldPickerScroll()).top
                )
                .toBeGreaterThan(0);

            // Escape goes to the topmost layer: the picker closes, the filters
            // popover (and the draft in it) stays.
            await page.keyboard.press('Escape');
            await expect(contentLibraryPage.fieldPickerList()).toBeHidden();
            await expect(contentLibraryPage.filterSurface()).toBeVisible();
            await expect(contentLibraryPage.filterConditionCount()).toHaveText(
                '1 condition'
            );
        });

        test('a click outside closes it and discards the draft [query-builder:I-14]', async ({
            contentLibraryPage,
            page
        }) => {
            await page.goto(ARTICLES_URL);
            await expect(
                contentLibraryPage.recordsTable('Articles')
            ).toBeVisible();

            await contentLibraryPage.openFilters();
            await contentLibraryPage.addRule();
            await expect(contentLibraryPage.filterConditionCount()).toHaveText(
                '1 condition'
            );

            await contentLibraryPage.recordsSearch.click();
            await expect(contentLibraryPage.filterTrigger()).toHaveAttribute(
                'aria-expanded',
                'false'
            );
            await expect(page).not.toHaveURL(/filter=/);

            // Reopened, it reads the applied filter — none — not the draft.
            await contentLibraryPage.openFilters();
            await expect(contentLibraryPage.filterConditionCount()).toHaveText(
                'No conditions'
            );
        });

        test('is accessible open, with a rule (axe)', async ({
            contentLibraryPage,
            page,
            makeAxe
        }) => {
            await page.goto(ARTICLES_URL);
            await expect(
                contentLibraryPage.recordsTable('Articles')
            ).toBeVisible();

            await contentLibraryPage.openFilters();
            await contentLibraryPage.addRule();
            await expectNoA11yViolations(makeAxe());
        });
    });

    test('the field picker offers a related type field, grouped', async ({
        contentLibraryPage,
        page
    }) => {
        await page.goto(ARTICLES_URL);
        await expect(contentLibraryPage.recordsTable('Articles')).toBeVisible();

        await contentLibraryPage.openFilters();
        await contentLibraryPage.addRule();

        // Open the field picker and search for the relation path. The related
        // type's `name` surfaces under its relation's breadcrumb ("Author").
        await contentLibraryPage
            .filterSurface()
            .getByRole('combobox')
            .first()
            .click();
        await page
            .getByPlaceholder('Search fields and relations')
            .fill('Author Name');
        await expect(
            page.getByRole('option', { name: 'Name', exact: true })
        ).toBeVisible();
    });

    test('applying a relation-path rule deep-links the dotted path', async ({
        contentLibraryPage,
        page
    }) => {
        await page.goto(ARTICLES_URL);
        await expect(contentLibraryPage.recordsTable('Articles')).toBeVisible();

        await contentLibraryPage.openFilters();
        await contentLibraryPage.addRule();
        await contentLibraryPage.selectFieldSearch('Author Name', 'Name');
        // Picking a field resets the operator to the first one its type
        // offers, which for a string is `equals` (→ `eq`).
        await contentLibraryPage.fillValue('Ada');
        await contentLibraryPage.applyFilters();

        // The dotted path round-trips into the URL as the query-builder wire
        // JSON — the same string the list request carries to the server.
        await expect(page).toHaveURL(/filter=/);
        const filterParam = new URL(page.url()).searchParams.get('filter');
        expect(filterParam).not.toBeNull();
        const tree = JSON.parse(filterParam as string);
        expect(tree.and[0].field).toBe('author.name');
        expect(tree.and[0].op).toBe('eq');
        expect(tree.and[0].value).toBe('Ada');
    });

    test('a "contains" rule wraps its value in escaped wildcards [query-builder:I-12]', async ({
        contentLibraryPage,
        page
    }) => {
        await page.goto(ARTICLES_URL);
        await expect(contentLibraryPage.recordsTable('Articles')).toBeVisible();

        await contentLibraryPage.openFilters();
        await contentLibraryPage.addRule();
        await contentLibraryPage.selectFieldSearch('Author Name', 'Name');
        await contentLibraryPage.selectOperatorExact('contains');
        await contentLibraryPage.fillValue('Ada');
        await contentLibraryPage.applyFilters();

        const tree = JSON.parse(
            new URL(page.url()).searchParams.get('filter') as string
        );
        expect(tree.and[0]).toEqual({
            field: 'author.name',
            op: 'ilike',
            value: '%Ada%'
        });
    });

    test('a relation id rule picks records, not raw uuids', async ({
        contentLibraryPage,
        page
    }) => {
        await page.goto(ARTICLES_URL);
        await expect(contentLibraryPage.recordsTable('Articles')).toBeVisible();

        await contentLibraryPage.openFilters();
        await contentLibraryPage.addRule();
        // The relation's own `id` path — labelled by the relation ("Author"),
        // and the one field the builder renders as a record picker.
        await contentLibraryPage.selectFieldSearch('author.id', 'Author');
        await contentLibraryPage.openRelationValuePicker();
        await contentLibraryPage.pickRelationRecord('Ada Lovelace');
        await contentLibraryPage.closeRelationValuePicker();
        await contentLibraryPage.applyFilters();

        const tree = JSON.parse(
            new URL(page.url()).searchParams.get('filter') as string
        );
        expect(tree.and[0].field).toBe('author.id');
        // The picker writes the target's id, never a title the API can't
        // resolve — the whole reason it isn't a free-text uuid box. A
        // single-valued operator narrows the picked set back to one id.
        expect(tree.and[0].op).toBe('eq');
        expect(tree.and[0].value).toBe(RELATION_AUTHOR_IDS.ada);
    });

    test('a relation id rule keeps a set for a multi-valued operator', async ({
        contentLibraryPage,
        page
    }) => {
        await page.goto(ARTICLES_URL);
        await expect(contentLibraryPage.recordsTable('Articles')).toBeVisible();

        await contentLibraryPage.openFilters();
        await contentLibraryPage.addRule();
        await contentLibraryPage.selectFieldSearch('author.id', 'Author');
        await contentLibraryPage.selectOperatorExact('is one of');
        await contentLibraryPage.openRelationValuePicker();
        // The picker is a multi-select: the popover stays open between picks.
        await contentLibraryPage.pickRelationRecord('Ada Lovelace');
        await contentLibraryPage.pickRelationRecord('Grace Hopper');
        await contentLibraryPage.closeRelationValuePicker();
        await contentLibraryPage.applyFilters();

        const tree = JSON.parse(
            new URL(page.url()).searchParams.get('filter') as string
        );
        expect(tree.and[0].op).toBe('in');
        expect(tree.and[0].value).toEqual([
            RELATION_AUTHOR_IDS.ada,
            RELATION_AUTHOR_IDS.grace
        ]);
    });

    /**
     * The negative operators shipped alongside relation filtering. Their wire
     * ops are what the server rewrites into `NOT EXISTS` on a relation path,
     * so the FE spelling has to be exact — a silent mismatch here reads as a
     * filter that returns the wrong rows rather than an error.
     */
    test.describe('negative operators', () => {
        test('"does not contain" serialises to nilike', async ({
            contentLibraryPage,
            page
        }) => {
            await page.goto(ARTICLES_URL);
            await expect(
                contentLibraryPage.recordsTable('Articles')
            ).toBeVisible();

            await contentLibraryPage.openFilters();
            await contentLibraryPage.addRule();
            await contentLibraryPage.selectFieldSearch('Author Name', 'Name');
            await contentLibraryPage.selectOperatorExact('does not contain');
            await contentLibraryPage.fillValue('Ada');
            await contentLibraryPage.applyFilters();

            const tree = JSON.parse(
                new URL(page.url()).searchParams.get('filter') as string
            );
            expect(tree.and[0]).toEqual({
                field: 'author.name',
                op: 'nilike',
                value: '%Ada%'
            });
        });

        test('"is not empty" serialises to null:false', async ({
            contentLibraryPage,
            page
        }) => {
            await page.goto(ARTICLES_URL);
            await expect(
                contentLibraryPage.recordsTable('Articles')
            ).toBeVisible();

            await contentLibraryPage.openFilters();
            await contentLibraryPage.addRule();
            await contentLibraryPage.selectFieldSearch('Author Name', 'Name');
            await contentLibraryPage.selectOperatorExact('is not empty');
            // No value editor for a presence check — the operator carries it.
            await contentLibraryPage.applyFilters();

            const tree = JSON.parse(
                new URL(page.url()).searchParams.get('filter') as string
            );
            expect(tree.and[0]).toEqual({
                field: 'author.name',
                op: 'null',
                value: false
            });
        });
    });

    /**
     * The resting state: applied conditions read out as removable chips under
     * the toolbar, so the active filter is visible without re-opening the
     * popover.
     */
    test.describe('applied-filter summary', () => {
        /**
         * Apply `author.name contains Ada`. A valid Apply closes the popover;
         * `closeFilters()` asserts that it did.
         */
        async function applyAndCollapse(
            contentLibraryPage: ContentLibraryPage,
            page: Page
        ) {
            await page.goto(ARTICLES_URL);
            await expect(
                contentLibraryPage.recordsTable('Articles')
            ).toBeVisible();
            await contentLibraryPage.openFilters();
            await contentLibraryPage.addRule();
            await contentLibraryPage.selectFieldSearch('Author Name', 'Name');
            await contentLibraryPage.fillValue('Ada');
            await contentLibraryPage.applyFilters();
            await contentLibraryPage.closeFilters();
        }

        test('reads the applied condition back as a chip', async ({
            contentLibraryPage,
            page
        }) => {
            await applyAndCollapse(contentLibraryPage, page);

            // Relation crumb + leaf + operator + value, so the chip says what
            // is filtered without expanding the builder.
            await expect(
                contentLibraryPage.filterChip('Author · Name equals Ada')
            ).toBeVisible();
        });

        test('removing a chip re-commits the narrowed filter', async ({
            contentLibraryPage,
            page
        }) => {
            await applyAndCollapse(contentLibraryPage, page);
            await contentLibraryPage.removeFilterChip('Author · Name equals');

            // The last condition removed clears the param entirely, rather
            // than leaving an empty group the server would reject.
            await expect(page).not.toHaveURL(/filter=/);
        });

        test('"Clear all" drops every condition [query-builder:I-13]', async ({
            contentLibraryPage,
            page
        }) => {
            await applyAndCollapse(contentLibraryPage, page);
            await contentLibraryPage.clearAllFilters();

            await expect(page).not.toHaveURL(/filter=/);
        });
    });

    /**
     * The filterable surface is fetched, not derived, so it has a failure mode
     * the old client-side mirror didn't. Without field definitions the Apply
     * gate rejects every rule, so an empty picker would be a dead button —
     * the popover has to name the failure instead.
     */
    test.describe('filter fields unavailable', () => {
        test.beforeEach(async ({ page }) => {
            await mockContentSchemaDetail(page, {
                details: RELATIONS_DETAIL_SEED,
                filterFieldsStatus: 500
            });
        });

        test('shows an error state instead of an empty picker [query-builder:I-15]', async ({
            contentLibraryPage,
            page
        }) => {
            await page.goto(ARTICLES_URL);
            await expect(
                contentLibraryPage.recordsTable('Articles')
            ).toBeVisible();
            await contentLibraryPage.openFilters();

            // The query client retries 3× with exponential backoff, so the
            // error state lands ~7s in — past the default expect timeout.
            await expect(contentLibraryPage.filterFieldsError()).toContainText(
                "Couldn't load the filterable fields",
                { timeout: 20_000 }
            );
            // Apply is disabled, not merely inert — pressing it could never
            // commit, and a button that does nothing reads as a broken page.
            await expect(contentLibraryPage.applyButton()).toBeDisabled();
        });

        test('the table itself still loads', async ({
            contentLibraryPage,
            page
        }) => {
            await page.goto(ARTICLES_URL);
            // A failed filter surface must not take the records list with it.
            await expect(
                contentLibraryPage.recordsTable('Articles')
            ).toBeVisible();
        });
    });
});
