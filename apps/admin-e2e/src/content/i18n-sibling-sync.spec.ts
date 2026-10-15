import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { expectNoA11yViolations } from '../support/a11y';
import { type ContentLibraryPage } from '../support/pages/ContentLibraryPage';
import {
    I18N_WORKSPACE,
    mockI18n,
    mockSiblingSync
} from '../support/api/i18n';

/**
 * A save that reaches other locales of the record — a shared field changed, a
 * synced relation relinked — asks **once**. The editor sends it with
 * `askBeforeSiblingSync`; the server refuses with every locale it would change
 * and the published ones it would leave invalid, and the editor turns that one
 * answer into one dialog. It used to ask about the sync from the client, then,
 * after the server refused, ask again about the damage.
 */
test.describe('Saving a change other locales share [i18n:I-34] [i18n:I-35]', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [I18N_WORKSPACE]);
        await mockI18n(page);
    });

    async function changeSharedCategory(
        contentLibraryPage: ContentLibraryPage
    ) {
        await contentLibraryPage.goto(I18N_WORKSPACE.id);
        await contentLibraryPage.typeLink('Localized posts').click();
        await contentLibraryPage.recordLink('Winter boots').click();
        await expect(contentLibraryPage.editorSave).toBeVisible();
        // `category` is shared: one value for every locale of the record.
        await contentLibraryPage.pickFieldOption('category', 'news');
        await contentLibraryPage.saveDraft();
    }

    test('a plain sync names the field and the locale, and Save resends without asking', async ({
        page,
        contentLibraryPage
    }) => {
        const patches = await mockSiblingSync(page, 'lp-en-1', {
            reached: ['de']
        });
        await changeSharedCategory(contentLibraryPage);

        const dialog = contentLibraryPage.siblingSyncDialog;
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText('This also changes another locale');
        await expect(dialog).toContainText('“Category”');
        await expect(dialog).toContainText('de');

        await contentLibraryPage.dialogButton('Save').click();
        await expect.poll(() => patches.length).toBe(2);
        expect(patches[0].askBeforeSiblingSync).toBe(true);
        expect(patches[1].askBeforeSiblingSync).toBeUndefined();
        // Nothing was going to break, so nothing breaking was confirmed.
        expect(patches[1].allowInvalidSiblings).toBeUndefined();
        await expect(dialog).toBeHidden();
    });

    test('a sync that breaks a published translation is one dialog, not two', async ({
        page,
        contentLibraryPage
    }) => {
        const patches = await mockSiblingSync(page, 'lp-en-1', {
            reached: ['de', 'fr'],
            invalidated: [{ locale: 'de', field: 'category' }]
        });
        await changeSharedCategory(contentLibraryPage);

        const dialog = contentLibraryPage.siblingSyncDialog;
        await expect(dialog).toContainText(
            'This leaves a published locale incomplete'
        );
        await expect(dialog).toContainText('de and fr');
        await expect(dialog).toContainText('“Category”');
        // The sibling's issue is not pinned on this form's own field.
        await expect(contentLibraryPage.fieldError('is required')).toHaveCount(
            0
        );

        await contentLibraryPage.dialogButton('Save anyway').click();
        await expect.poll(() => patches.length).toBe(2);
        expect(patches[1].askBeforeSiblingSync).toBeUndefined();
        expect(patches[1].allowInvalidSiblings).toBe(true);
        await expect(dialog).toBeHidden();
    });

    test('a translation that broke after asking is asked about again', async ({
        page,
        contentLibraryPage
    }) => {
        const patches = await mockSiblingSync(page, 'lp-en-1', {
            reached: ['de'],
            afterAsk: [{ locale: 'de', field: 'category' }]
        });
        await changeSharedCategory(contentLibraryPage);

        const dialog = contentLibraryPage.siblingSyncDialog;
        await contentLibraryPage.dialogButton('Save').click();
        // The resend is refused for an invalidation the person was never
        // shown, so it is not confirmed silently: the same dialog asks.
        await expect(dialog).toContainText(
            'This leaves a published locale incomplete'
        );
        expect(patches[1].allowInvalidSiblings).toBeUndefined();

        await contentLibraryPage.dialogButton('Save anyway').click();
        await expect.poll(() => patches.length).toBe(3);
        expect(patches[2].allowInvalidSiblings).toBe(true);
        await expect(dialog).toBeHidden();
    });

    test('a save that reaches no other locale saves without asking', async ({
        page,
        contentLibraryPage
    }) => {
        const patches = await mockSiblingSync(page, 'lp-en-1', {
            reached: []
        });
        await changeSharedCategory(contentLibraryPage);

        await expect.poll(() => patches.length).toBe(1);
        expect(patches[0].askBeforeSiblingSync).toBe(true);
        await expect(contentLibraryPage.siblingSyncDialog).toBeHidden();
    });

    test('Cancel saves nothing more', async ({ page, contentLibraryPage }) => {
        const patches = await mockSiblingSync(page, 'lp-en-1', {
            reached: ['de'],
            invalidated: [{ locale: 'de', field: 'category' }]
        });
        await changeSharedCategory(contentLibraryPage);

        await expect(contentLibraryPage.siblingSyncDialog).toBeVisible();
        await contentLibraryPage.dialogButton('Cancel').click();
        await expect(contentLibraryPage.siblingSyncDialog).toBeHidden();
        expect(patches).toHaveLength(1);
    });

    test('has no a11y violations while asking', async ({
        page,
        contentLibraryPage,
        makeAxe
    }) => {
        await mockSiblingSync(page, 'lp-en-1', {
            reached: ['de', 'fr'],
            invalidated: [
                { locale: 'de', field: 'category' },
                { locale: 'fr', field: 'category' }
            ]
        });
        await changeSharedCategory(contentLibraryPage);
        await expect(contentLibraryPage.siblingSyncDialog).toContainText(
            'published locales incomplete'
        );
        await expectNoA11yViolations(makeAxe());
    });
});
