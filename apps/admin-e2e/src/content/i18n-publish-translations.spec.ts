import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    I18N_WORKSPACE,
    mockI18n,
    spyEntryWrites,
    type EntryWrite
} from '../support/api/i18n';
import { expectNoA11yViolations } from '../support/a11y';
import { type ContentLibraryPage } from '../support/pages/ContentLibraryPage';

/**
 * **Publish with translations…** — the records selection bar's "deep" bulk
 * publish on a localized type (`@orthacms/i18n-admin`). The picker is a
 * records × locales matrix: a column's checkbox picks that locale for every
 * selected record, a row's for every translation of one record, a cell for
 * one. Continuing hands the picked entry ids to content's own bulk-publish
 * pre-flight.
 *
 * The seed (`mockI18n`), in the default English list:
 * - **Winter boots** — English is live, its German sibling is **Modified**,
 *   no French or Arabic;
 * - **Rain jacket** — an English draft and nothing else.
 *
 * So with every option picked, two entries go out: the German boots and the
 * English jacket. The live English boots is not an option at all — the dry run
 * would only answer "already published".
 */
test.describe('Publish with translations', () => {
    let writes: EntryWrite[];

    test.beforeEach(async ({ page, contentLibraryPage }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [I18N_WORKSPACE]);
        await mockI18n(page);
        writes = spyEntryWrites(page);

        await contentLibraryPage.goto(I18N_WORKSPACE.id);
        await contentLibraryPage.typeLink('Localized posts').click();
        await expect(
            contentLibraryPage.recordsTable('Localized posts')
        ).toBeVisible();
    });

    async function openPicker(contentLibraryPage: ContentLibraryPage) {
        await contentLibraryPage.rowCheckbox('Localized posts', 0).click();
        await contentLibraryPage.rowCheckbox('Localized posts', 1).click();
        await expect(contentLibraryPage.selectionCount).toHaveText(
            '2 selected'
        );
        await contentLibraryPage.bulkActions.click();
        await contentLibraryPage
            .bulkAction('Publish with translations…')
            .click();
        await expect(contentLibraryPage.translationsPicker).toBeVisible();
    }

    /** The ids of the commit (not the dry run) the review sent. */
    function publishedIds(): string[] | undefined {
        const commit = writes.find((write) =>
            write.path.endsWith('/bulk/publish')
        );
        return (commit?.body as { ids?: string[] } | null)?.ids;
    }

    test('starts with every translation that has something to publish', async ({
        contentLibraryPage
    }) => {
        await openPicker(contentLibraryPage);

        await expect(
            contentLibraryPage.translationsCell('Winter boots', 'Deutsch')
        ).toBeChecked();
        await expect(
            contentLibraryPage.translationsCell('Rain jacket', 'English')
        ).toBeChecked();
        // The live English boots is stated, not offered.
        await expect(
            contentLibraryPage.translationsCell('Winter boots', 'English')
        ).toHaveCount(0);
        // Nobody has a French translation, so the column cannot be picked.
        await expect(
            contentLibraryPage.translationsPicker.getByRole('checkbox', {
                name: 'Nothing to publish in Français'
            })
        ).toBeDisabled();
        await expect(contentLibraryPage.translationsReview).toHaveText(
            'Review 2 entries'
        );

        await contentLibraryPage.translationsReview.click();
        await expect(
            contentLibraryPage.preflightRow('Winterstiefel · Deutsch')
        ).toContainText('Will publish');
        await expect(
            contentLibraryPage.preflightRow('Rain jacket · English')
        ).toContainText('Will publish');
        await contentLibraryPage.preflightConfirm.click();
        await expect(
            contentLibraryPage.toast('2 records published.')
        ).toBeVisible();
        expect(publishedIds()).toEqual(['lp-de-1', 'lp-en-2']);
        // A publish that went through clears the selection.
        await expect(contentLibraryPage.selectionCount).toHaveCount(0);
    });

    test('picks a locale for every record, or one record’s translation', async ({
        contentLibraryPage
    }) => {
        await openPicker(contentLibraryPage);

        // Back to what a plain bulk publish would do: the rows' own locale.
        await contentLibraryPage
            .translationsPreset('Selected locale only')
            .click();
        await expect(
            contentLibraryPage.translationsLocaleToggle('Deutsch')
        ).not.toBeChecked();
        await expect(contentLibraryPage.translationsReview).toHaveText(
            'Review 1 entry'
        );

        // German for every record, from the column…
        await contentLibraryPage.translationsLocaleToggle('Deutsch').click();
        await expect(
            contentLibraryPage.translationsCell('Winter boots', 'Deutsch')
        ).toBeChecked();
        // …then English off for every record, leaving only the German boots.
        await contentLibraryPage.translationsLocaleToggle('English').click();
        await expect(
            contentLibraryPage.translationsCell('Rain jacket', 'English')
        ).not.toBeChecked();
        await expect(contentLibraryPage.translationsReview).toHaveText(
            'Review 1 entry'
        );

        // One cell at a time works too.
        await contentLibraryPage
            .translationsCell('Winter boots', 'Deutsch')
            .click();
        await expect(contentLibraryPage.translationsReview).toBeDisabled();
        await contentLibraryPage
            .translationsRecordToggle('Rain jacket')
            .click();
        await expect(contentLibraryPage.translationsReview).toHaveText(
            'Review 1 entry'
        );

        await contentLibraryPage.translationsReview.click();
        await contentLibraryPage.preflightConfirm.click();
        await expect(
            contentLibraryPage.toast('1 record published.')
        ).toBeVisible();
        expect(publishedIds()).toEqual(['lp-en-2']);
    });

    test('the picker has no a11y violations', async ({
        contentLibraryPage,
        makeAxe
    }) => {
        await openPicker(contentLibraryPage);
        await expect(contentLibraryPage.translationsReview).toBeEnabled();
        await expectNoA11yViolations(makeAxe());
    });
});
