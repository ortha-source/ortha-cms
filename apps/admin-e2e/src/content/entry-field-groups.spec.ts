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
import { I18N_WORKSPACE, mockI18n } from '../support/api/i18n';

/**
 * How a localized type's form says which fields are **shared** — since
 * ADR-0022, beside each field rather than by splitting the form into a
 * "Translated fields" run over a "Shared fields" one.
 *
 * Whether editing a field changes every locale is the one thing on the form a
 * reader must not have to infer; it used to be said once, above a group. The
 * form now keeps the schema's order, so each field says it itself — a globe
 * for one that differs per locale, "All locales" for one that does not — and
 * a plain type, with no locales, says neither.
 */
test.describe('Entry editor locale scope marks', () => {
    test.describe('a type with both translated and shared fields', () => {
        test.beforeEach(async ({ page }) => {
            await mockSignedIn(page);
            await mockWorkspaces(page, [I18N_WORKSPACE]);
            await mockI18n(page);
        });

        test('marks each field in place and draws no group headings', async ({
            contentLibraryPage
        }) => {
            await contentLibraryPage.gotoNewEntry(
                I18N_WORKSPACE.id,
                'localized_post'
            );
            await expect(contentLibraryPage.editorSave).toBeVisible();

            await expect(
                contentLibraryPage.localizedMark.first()
            ).toBeVisible();
            await expect(contentLibraryPage.sharedMark.first()).toBeVisible();
            await expect(
                contentLibraryPage.fieldGroupHeading('Translated fields')
            ).toHaveCount(0);
            await expect(
                contentLibraryPage.fieldGroupHeading('Shared fields')
            ).toHaveCount(0);
        });
    });

    test.describe('a type whose fields are all one kind', () => {
        test.beforeEach(async ({ page }) => {
            await mockSignedIn(page);
            await mockContentSchema(page);
            await mockContentSchemaDetail(page);
            await mockContentEntries(page);
            await mockContentEntryWrites(page);
            await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        });

        test('says nothing about locales', async ({ contentLibraryPage }) => {
            // `product` is a plain, non-i18n type: there are no other locales
            // for a field to be shared with, so neither mark applies.
            await contentLibraryPage.gotoNewEntry(
                LIBRARY_WORKSPACE.id,
                'product'
            );
            await expect(contentLibraryPage.fieldTextbox('Name')).toBeVisible();

            await expect(contentLibraryPage.sharedMark).toHaveCount(0);
            await expect(contentLibraryPage.localizedMark).toHaveCount(0);
        });
    });
});
