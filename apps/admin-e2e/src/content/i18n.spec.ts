import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { I18N_WORKSPACE, mockI18n } from '../support/api/i18n';
import { type ContentLibraryPage } from '../support/pages/ContentLibraryPage';

/**
 * Content localization in the admin (`@ortha-cms/i18n-admin`), driving the
 * Content Library's extension slots against a mocked API: the records-toolbar
 * locale switcher (and its `?locale=` round-trip), the Locales table column,
 * and the entry editor's locale panel (open a sibling, create a translation).
 */
test.describe('Content i18n', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [I18N_WORKSPACE]);
        await mockI18n(page);
    });

    async function openCollection(contentLibraryPage: ContentLibraryPage) {
        await contentLibraryPage.goto(I18N_WORKSPACE.id);
        await contentLibraryPage.typeLink('Localized posts').click();
        await expect(
            contentLibraryPage.recordsTable('Localized posts')
        ).toBeVisible();
    }

    test('shows the locale switcher on a localized collection', async ({
        contentLibraryPage
    }) => {
        await openCollection(contentLibraryPage);
        // Defaults to the default locale (English).
        await expect(contentLibraryPage.localeSwitcher).toHaveText(
            /Locale: English|English/
        );
    });

    test('switching locale updates the URL and re-scopes the table', async ({
        page,
        contentLibraryPage
    }) => {
        await openCollection(contentLibraryPage);

        // Default (en) list shows the English rows, not the German sibling.
        await expect(
            contentLibraryPage.recordsTable('Localized posts')
        ).toContainText('Winter boots');
        await expect(
            contentLibraryPage.recordsTable('Localized posts')
        ).not.toContainText('Winterstiefel');

        await contentLibraryPage.selectLocale(/Deutsch/);

        // The URL carries the active locale, and the table now shows the de row.
        await expect(page).toHaveURL(/locale=de/);
        await expect(
            contentLibraryPage.recordsTable('Localized posts')
        ).toContainText('Winterstiefel');
        await expect(
            contentLibraryPage.recordsTable('Localized posts')
        ).not.toContainText('Winter boots');
    });

    test('the Locales column shows per-group locale badges', async ({
        contentLibraryPage
    }) => {
        await openCollection(contentLibraryPage);

        // The Locales column is off by default — enable it via the column picker.
        await contentLibraryPage.columnsButton.click();
        await contentLibraryPage.columnOption('Locales').click();
        await contentLibraryPage.columnsButton.click(); // close the popover

        // Group G1's row (Winter boots) has en + de badges linking to each
        // locale's editor; group G2's row (Rain jacket) has only an en badge.
        const g1Row = contentLibraryPage
            .recordRows('Localized posts')
            .filter({ hasText: 'Winter boots' });
        await expect(
            g1Row.getByRole('link', { name: /Open the en version/ })
        ).toBeVisible();
        await expect(
            g1Row.getByRole('link', { name: /Open the de version/ })
        ).toBeVisible();

        const g2Row = contentLibraryPage
            .recordRows('Localized posts')
            .filter({ hasText: 'Rain jacket' });
        await expect(
            g2Row.getByRole('link', { name: /Open the de version/ })
        ).toHaveCount(0);
    });

    test('the entry editor shows the locale panel with sibling + missing rows', async ({
        contentLibraryPage
    }) => {
        await openCollection(contentLibraryPage);
        // Open the en row of group G1 (which has a de sibling, no fr).
        await contentLibraryPage
            .recordsTable('Localized posts')
            .getByRole('link', { name: /Winter boots/ })
            .click();

        await expect(contentLibraryPage.editorSave).toBeVisible();
        await expect(contentLibraryPage.localeWidget).toBeVisible();

        // The de sibling exists → Open; fr is missing → Create translation.
        await expect(
            contentLibraryPage.openTranslation('Deutsch')
        ).toBeVisible();
        await expect(
            contentLibraryPage.createTranslation('Français')
        ).toBeVisible();
    });

    test('creating a translation navigates to the new locale row', async ({
        page,
        contentLibraryPage
    }) => {
        await openCollection(contentLibraryPage);
        await contentLibraryPage
            .recordsTable('Localized posts')
            .getByRole('link', { name: /Winter boots/ })
            .click();
        await expect(contentLibraryPage.localeWidget).toBeVisible();

        await contentLibraryPage.createTranslation('Français').click();

        // Navigates to the freshly created fr row's editor.
        await expect(page).toHaveURL(/\/localized_post\/lp-fr-new$/);
    });
});
