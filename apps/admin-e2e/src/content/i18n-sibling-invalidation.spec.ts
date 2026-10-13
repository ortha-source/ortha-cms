import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { expectNoA11yViolations } from '../support/a11y';
import { type ContentLibraryPage } from '../support/pages/ContentLibraryPage';
import {
    I18N_WORKSPACE,
    mockI18n,
    mockSiblingInvalidation
} from '../support/api/i18n';

/**
 * A save the server refuses because it would leave a **published** translation
 * failing validation — a shared field cleared, a synced relation unlinked. The
 * editor used to pin the sibling's issues on its own form (marking fields the
 * author had filled) with no way through; it now asks, naming the locales and
 * the fields, and **Save anyway** resends the same save confirmed.
 */
test.describe('Saving past an invalidated translation [i18n:I-34]', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [I18N_WORKSPACE]);
        await mockI18n(page);
    });

    async function openWinterBoots(contentLibraryPage: ContentLibraryPage) {
        await contentLibraryPage.goto(I18N_WORKSPACE.id);
        await contentLibraryPage.typeLink('Localized posts').click();
        await contentLibraryPage.recordLink('Winter boots').click();
        await expect(contentLibraryPage.editorSave).toBeVisible();
    }

    test('asks, names the locale and field, and resends confirmed', async ({
        page,
        contentLibraryPage
    }) => {
        const patches = await mockSiblingInvalidation(page, 'lp-en-1', [
            { locale: 'de', field: 'category' }
        ]);
        await openWinterBoots(contentLibraryPage);

        // `category` is shared, so the ordinary warning comes first.
        await contentLibraryPage.pickFieldOption('category', 'news');
        await contentLibraryPage.saveDraft();
        await expect(contentLibraryPage.sharedSaveDialog).toBeVisible();
        await contentLibraryPage.dialogButton('Save anyway').click();

        // The server refuses: the editor asks instead of failing the form.
        const dialog = contentLibraryPage.siblingInvalidationDialog;
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText('de');
        await expect(dialog).toContainText('“Category”');
        // The sibling's issue is not pinned on this form's own field.
        await expect(contentLibraryPage.fieldError('is required')).toHaveCount(
            0
        );

        await contentLibraryPage.dialogButton('Save anyway').click();
        await expect.poll(() => patches.length).toBe(2);
        expect(patches[0].allowInvalidSiblings).toBeUndefined();
        expect(patches[1].allowInvalidSiblings).toBe(true);
        await expect(dialog).toBeHidden();
    });

    test('Cancel saves nothing more', async ({ page, contentLibraryPage }) => {
        const patches = await mockSiblingInvalidation(page, 'lp-en-1', [
            { locale: 'de', field: 'category' }
        ]);
        await openWinterBoots(contentLibraryPage);
        await contentLibraryPage.pickFieldOption('category', 'news');
        await contentLibraryPage.saveDraft();
        await contentLibraryPage.dialogButton('Save anyway').click();

        await expect(
            contentLibraryPage.siblingInvalidationDialog
        ).toBeVisible();
        await contentLibraryPage.dialogButton('Cancel').click();
        await expect(contentLibraryPage.siblingInvalidationDialog).toBeHidden();
        expect(patches).toHaveLength(1);
    });

    test('has no a11y violations while asking', async ({
        page,
        contentLibraryPage,
        makeAxe
    }) => {
        await mockSiblingInvalidation(page, 'lp-en-1', [
            { locale: 'de', field: 'category' },
            { locale: 'fr', field: 'category' }
        ]);
        await openWinterBoots(contentLibraryPage);
        await contentLibraryPage.pickFieldOption('category', 'news');
        await contentLibraryPage.saveDraft();
        await contentLibraryPage.dialogButton('Save anyway').click();
        await expect(
            contentLibraryPage.siblingInvalidationDialog
        ).toContainText('de and fr');
        await expectNoA11yViolations(makeAxe());
    });
});
