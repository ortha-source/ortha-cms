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
import { mockSegmentsApi } from '../support/api/segments';

const ARTICLES_URL = `/workspaces/${RELATIONS_WORKSPACE.id}/content/article`;

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
 * Filtering the records list by **who can read a record**.
 *
 * The three fields are contributed into the list's own query builder, so what
 * matters in a browser is that they reach the picker at all, that they sit under
 * their own heading rather than scattering through the collection's columns, and
 * that a completed rule serialises into the `?filter=` the server understands.
 */
test.describe('Records list — filtering by audience', () => {
    test('offers the access fields under a Segmentation heading', async ({
        page,
        contentLibraryPage
    }) => {
        // `group` on a flat field id names a plain category, not a relation.
        // Ungrouped these scattered through the collection's own columns, where
        // a reader had to already know the feature existed to recognise them as
        // one thing.
        await mockSegmentsApi(page);
        await page.goto(ARTICLES_URL);
        await expect(contentLibraryPage.recordsTable('Articles')).toBeVisible();

        await contentLibraryPage.openFilters();
        await contentLibraryPage.addRule();
        await contentLibraryPage
            .filterSurface()
            .getByRole('combobox')
            .first()
            .click();

        await expect(page.getByText('Segmentation')).toBeVisible();
        for (const label of [
            'Can be seen by',
            'Cannot be seen by',
            'Access restricted'
        ]) {
            await expect(
                page.getByRole('option', { name: label, exact: true })
            ).toBeVisible();
        }
    });

    test('opens on the multi-select, and names several audiences in one rule', async ({
        page,
        contentLibraryPage
    }) => {
        // Picking the field lands on `is one of` rather than `is`: the question
        // is *which audiences*, and one control answers it for one or for
        // several. Led by `is`, naming a second audience meant first noticing
        // there was a second operator.
        await mockSegmentsApi(page);
        await page.goto(ARTICLES_URL);
        await expect(contentLibraryPage.recordsTable('Articles')).toBeVisible();

        await contentLibraryPage.openFilters();
        await contentLibraryPage.addRule();
        await contentLibraryPage.selectField('Can be seen by');
        // The values are the audiences' **ids**, because that is what an entry's
        // lists hold — a key can be renamed without touching either.
        await contentLibraryPage.pickEnumValues('Acme Corp', 'Globex');
        await contentLibraryPage.applyFilters();

        await expect(page).toHaveURL(/audienceAllowed/);
        await expect(page).toHaveURL(/seg-acme/);
        await expect(page).toHaveURL(/seg-globex/);
        // `in`, the server's array overlap — "either of them", not "both".
        await expect(page).toHaveURL(/%22in%22|"in"/);
    });

    test('names the audience in the applied chip, not its uuid', async ({
        page,
        contentLibraryPage
    }) => {
        // The chip is the only reading of a rule once the panel has collapsed,
        // and these values are opaque ids by design. Unresolved it said
        // "Can be seen by is one of seg-acme", which names neither the audience
        // nor the mistake when it is the wrong one.
        await mockSegmentsApi(page);
        await page.goto(ARTICLES_URL);
        await expect(contentLibraryPage.recordsTable('Articles')).toBeVisible();

        await contentLibraryPage.openFilters();
        await contentLibraryPage.addRule();
        await contentLibraryPage.selectField('Can be seen by');
        await contentLibraryPage.pickEnumValues('Acme Corp');
        await contentLibraryPage.applyFilters();
        await contentLibraryPage.closeFilters();

        await expect(page.getByText(/Can be seen by/)).toContainText(
            'Acme Corp'
        );
        await expect(page.getByText('seg-acme')).toHaveCount(0);
    });

    test('does not offer them at all when the workspace has no audience', async ({
        page,
        contentLibraryPage
    }) => {
        // Inert until an audience exists: an enum with no values is a rule
        // nobody can complete, so the field must be absent rather than dead.
        await mockSegmentsApi(page, { segments: [] });
        await page.goto(ARTICLES_URL);
        await expect(contentLibraryPage.recordsTable('Articles')).toBeVisible();

        await contentLibraryPage.openFilters();
        await contentLibraryPage.addRule();
        await contentLibraryPage
            .filterSurface()
            .getByRole('combobox')
            .first()
            .click();

        await expect(page.getByText('Segmentation')).toHaveCount(0);
        await expect(
            page.getByRole('option', { name: 'Can be seen by', exact: true })
        ).toHaveCount(0);
    });

    test('offers no negation, because it would not mean what it reads as', async ({
        page,
        contentLibraryPage
    }) => {
        // `ne` negates *inside* the subquery — "has some allowed audience other
        // than Acme" — which an entry that also allows Acme satisfies. Offering
        // it would build a rule the server refuses, which reaches the user as
        // "couldn't load this collection".
        await mockSegmentsApi(page);
        await page.goto(ARTICLES_URL);
        await expect(contentLibraryPage.recordsTable('Articles')).toBeVisible();

        await contentLibraryPage.openFilters();
        await contentLibraryPage.addRule();
        await contentLibraryPage.selectField('Can be seen by');

        await contentLibraryPage
            .filterSurface()
            .getByRole('combobox')
            .nth(1)
            .click();
        await expect(
            page.getByRole('option', { name: 'is one of', exact: true })
        ).toBeVisible();
        await expect(
            page.getByRole('option', { name: 'is', exact: true })
        ).toBeVisible();
        await expect(
            page.getByRole('option', { name: 'is not', exact: true })
        ).toHaveCount(0);
        await expect(
            page.getByRole('option', { name: 'is none of', exact: true })
        ).toHaveCount(0);
    });
});
