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

    test('switching locale plays a brief "Switching…" overlay', async ({
        contentLibraryPage
    }) => {
        await openCollection(contentLibraryPage);
        await contentLibraryPage.selectLocale(/Deutsch/);
        // The transition flourish names the target locale.
        await expect(contentLibraryPage.localeSwitchOverlay).toHaveText(
            /Switching to Deutsch/
        );
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

    test('the entry editor locale switcher shows current / existing / missing', async ({
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

        // The title chip names the open locale (code + label).
        await expect(contentLibraryPage.editorTitleChip).toHaveText(
            'EN · English'
        );
        // The widget explains itself (saved-record copy).
        await expect(
            contentLibraryPage.paneText(/Switch between this record/)
        ).toBeVisible();

        // The de sibling exists → switch; fr is missing → create.
        await expect(
            contentLibraryPage.switchLocale('Deutsch')
        ).toBeVisible();
        await expect(
            contentLibraryPage.createTranslation('Français')
        ).toBeVisible();
    });

    test('switching to an existing sibling opens that locale row', async ({
        page,
        contentLibraryPage
    }) => {
        await openCollection(contentLibraryPage);
        await contentLibraryPage
            .recordsTable('Localized posts')
            .getByRole('link', { name: /Winter boots/ })
            .click();
        await expect(contentLibraryPage.localeWidget).toBeVisible();

        await contentLibraryPage.switchLocale('Deutsch').click();

        await expect(page).toHaveURL(/\/localized_post\/lp-de-1$/);
        // The title chip follows the open locale.
        await expect(contentLibraryPage.editorTitleChip).toHaveText(
            'DE · Deutsch'
        );
    });

    test('selecting a missing locale opens a prefilled draft form', async ({
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

        // Lands on a create form scoped to the target locale + the same group.
        await expect(page).toHaveURL(/\/localized_post\/new\?/);
        await expect(page).toHaveURL(/locale=fr/);
        await expect(page).toHaveURL(/localeGroupId=G1/);

        // Shared (non-localized) fields are prefilled from the source; the
        // localized Title starts blank for the translator, and shows the
        // localizable indicator.
        await expect(page.getByLabel('Category')).toContainText('guide');
        await expect(page.getByLabel(/Title/)).toHaveValue('');
        await expect(page.getByText('Localized field').first()).toBeAttached();
    });

    test('a brand-new record can be re-targeted to another locale before saving', async ({
        page,
        contentLibraryPage
    }) => {
        await openCollection(contentLibraryPage);
        await contentLibraryPage.addRecord.click();

        // The create form starts in the default locale; the widget is live even
        // though nothing is saved yet.
        await expect(page).toHaveURL(/\/localized_post\/new$/);
        await expect(contentLibraryPage.localeWidget).toBeVisible();

        // The chip shows the default locale, and the widget uses its create copy.
        await expect(contentLibraryPage.editorTitleChip).toHaveText(
            'EN · English'
        );
        await expect(
            contentLibraryPage.paneText(/Choose the locale for this new record/)
        ).toBeVisible();

        // Switch the form's target locale to German (no group yet — a fresh
        // record, just re-scoped).
        await contentLibraryPage.createTranslation('Deutsch').click();

        await expect(page).toHaveURL(/\/localized_post\/new\?/);
        await expect(page).toHaveURL(/locale=de/);
        await expect(page).not.toHaveURL(/localeGroupId=/);
    });

    test('a translation draft can jump to an existing sibling', async ({
        page,
        contentLibraryPage
    }) => {
        await openCollection(contentLibraryPage);
        await contentLibraryPage
            .recordsTable('Localized posts')
            .getByRole('link', { name: /Winter boots/ })
            .click();
        await expect(contentLibraryPage.localeWidget).toBeVisible();

        // Start a French translation of group G1 (which already has en + de).
        await contentLibraryPage.createTranslation('Français').click();
        await expect(page).toHaveURL(/localeGroupId=G1/);

        // On that draft form the widget still knows the group's members, so the
        // existing German sibling is a switch target.
        await contentLibraryPage.switchLocale('Deutsch').click();
        await expect(page).toHaveURL(/\/localized_post\/lp-de-1$/);
    });
});
