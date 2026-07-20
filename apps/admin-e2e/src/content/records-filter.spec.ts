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
 * The records-table **filter drawer** (`@ortha-cms/query-builder-admin`) over a
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
        // String fields default to the "contains" operator (→ ilike).
        await contentLibraryPage.fillValue('Ada');
        await contentLibraryPage.applyFilters();

        // The dotted path round-trips into the URL as the query-builder wire
        // JSON — the same string the list request carries to the server.
        await expect(page).toHaveURL(/filter=/);
        const filterParam = new URL(page.url()).searchParams.get('filter');
        expect(filterParam).not.toBeNull();
        const tree = JSON.parse(filterParam as string);
        expect(tree.and[0].field).toBe('author.name');
        expect(tree.and[0].op).toBe('ilike');
        expect(tree.and[0].value).toBe('%Ada%');
    });
});
