import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    I18N_WORKSPACE,
    mockI18n,
    spyEntryWrites,
    type EntryWrite
} from '../support/api/i18n';
import { mockReviewStatus } from '../support/api/publishing';
import { expectNoA11yViolations } from '../support/a11y';
import { type ContentLibraryPage } from '../support/pages/ContentLibraryPage';

/**
 * The **Publish Manager** (`@orthacms/publishing-admin`) — publishing a set of
 * records together with their translations and the drafts they link to, on a
 * page of its own. The seed (`mockI18n`), in the default English list:
 *
 * - **Winter boots** — English live, German **Modified**, no French/Arabic.
 *   Its German row is held by an approval rule (0 of 1).
 * - **Rain jacket** — an English draft, nothing else; it links a draft tag,
 *   **Outerwear**, through its Tags field.
 *
 * So "everything" is three entries: the German boots (a translation), the
 * English jacket (selected) and the tag (a linked draft). The live English
 * boots is never on offer.
 */
test.describe('Publish Manager', () => {
    let writes: EntryWrite[];

    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [I18N_WORKSPACE]);
        await mockI18n(page, {
            linked: {
                'lp-en-2': [
                    {
                        field: 'tags',
                        fieldLabel: 'Tags',
                        id: 'tag-1',
                        type: 'tag',
                        title: 'Outerwear',
                        status: 'draft'
                    }
                ]
            }
        });
        await mockReviewStatus(page, {
            'lp-de-1': {
                protected: true,
                required: 1,
                given: 0,
                stale: 0,
                requested: true,
                blocked: true
            }
        });
        writes = spyEntryWrites(page);
    });

    /** The ids of each committed batch, in the order they were sent. */
    function committedBatches(): string[][] {
        return writes
            .filter((write) => write.path.endsWith('/bulk/publish'))
            .map((write) => (write.body as { ids: string[] }).ids);
    }

    async function openFromSelection(contentLibraryPage: ContentLibraryPage) {
        await contentLibraryPage.goto(I18N_WORKSPACE.id);
        await contentLibraryPage.typeLink('Localized posts').click();
        await expect(
            contentLibraryPage.recordsTable('Localized posts')
        ).toBeVisible();
        await contentLibraryPage.rowCheckbox('Localized posts', 0).click();
        await contentLibraryPage.rowCheckbox('Localized posts', 1).click();
        await contentLibraryPage.bulkActions.click();
        await contentLibraryPage.bulkAction('Open in Publish Manager').click();
    }

    test('opens on a selection with its translations and linked drafts', async ({
        page,
        contentLibraryPage,
        publishManagerPage: manager
    }) => {
        await openFromSelection(contentLibraryPage);
        await expect(page).toHaveURL(
            /\/workspaces\/ws_i18n\/publish\?type=localized_post&ids=lp-en-1%2Clp-en-2/
        );
        await expect(manager.heading).toBeVisible();

        // Everything with something to publish starts picked…
        await expect(manager.cell('Winter boots', 'Deutsch')).toBeChecked();
        await expect(manager.cell('Rain jacket', 'English')).toBeChecked();
        await expect(manager.cell('Outerwear', 'Entry')).toBeChecked();
        // …the live English boots is stated, not offered…
        await expect(manager.cell('Winter boots', 'English')).toHaveCount(0);
        // …and the linked draft says where it came from, in its own section.
        await expect(manager.section('tag')).toContainText(
            'Linked draft · Tags on “Rain jacket”'
        );
        // Protection's note on the held German row.
        await expect(manager.section('Localized posts')).toContainText(
            'Approvals 0/1'
        );
        // The dry run has already answered for every option.
        await expect(manager.summary).toHaveText(
            '3 picked · 3 ready to publish'
        );
        await manager.publish.click();
        await expect(manager.outcome).toContainText('3 entries published');

        // Dependencies first: the tag goes out before the records linking it.
        expect(committedBatches()).toEqual([['tag-1'], ['lp-de-1', 'lp-en-2']]);
        // Re-read after the commit: nothing left to pick.
        await expect(manager.cell('Rain jacket', 'English')).toHaveCount(0);
    });

    test('picks per column, per record, per section and per cell', async ({
        publishManagerPage: manager
    }) => {
        await manager.goto(I18N_WORKSPACE.id, 'localized_post', [
            'lp-en-1',
            'lp-en-2'
        ]);
        await expect(manager.cell('Rain jacket', 'English')).toBeVisible();

        // What a plain bulk publish would do: just the selected rows.
        await manager.preset('Selected only').click();
        await expect(manager.summary).toHaveText(
            '1 picked · 1 ready to publish'
        );

        // German for every record, from its column.
        await manager.axisToggle('Deutsch', 'Localized posts').click();
        await expect(manager.cell('Winter boots', 'Deutsch')).toBeChecked();
        // The jacket off, as a whole record.
        await manager.recordToggle('Rain jacket').click();
        await expect(manager.cell('Rain jacket', 'English')).not.toBeChecked();
        // The linked tags on, as a section, then the one tag off again.
        await manager.sectionToggle('tag').click();
        await expect(manager.cell('Outerwear', 'Entry')).toBeChecked();
        await manager.cell('Outerwear', 'Entry').click();
        await expect(manager.summary).toHaveText(
            '1 picked · 1 ready to publish'
        );
        await expect(manager.publish).toHaveText('Publish 1 entry');

        await manager.publish.click();
        await expect(manager.outcome).toContainText('1 entry published');
        expect(committedBatches()).toEqual([['lp-de-1']]);
    });

    test('opens on one record from the editor’s ⋯ menu', async ({
        page,
        contentLibraryPage,
        publishManagerPage: manager
    }) => {
        await contentLibraryPage.goto(I18N_WORKSPACE.id);
        await contentLibraryPage.typeLink('Localized posts').click();
        await contentLibraryPage.recordLink('Winter boots').click();
        await expect(contentLibraryPage.editorSave).toBeVisible();
        await contentLibraryPage.openEditorMenu();
        await manager.openItem.click();

        await expect(page).toHaveURL(
            /publish\?type=localized_post&ids=lp-en-1$/
        );
        await expect(manager.cell('Winter boots', 'Deutsch')).toBeChecked();
        await expect(manager.summary).toHaveText(
            '1 picked · 1 ready to publish'
        );
    });

    test('folds every card away and back', async ({
        publishManagerPage: manager
    }) => {
        await manager.goto(I18N_WORKSPACE.id, 'localized_post', [
            'lp-en-1',
            'lp-en-2'
        ]);
        await expect(manager.cell('Rain jacket', 'English')).toBeVisible();

        await manager.toggleAll('Collapse all').click();
        await expect(manager.cell('Rain jacket', 'English')).toBeHidden();
        // Folding hides the rows, not the picks.
        await expect(manager.summary).toHaveText(
            '3 picked · 3 ready to publish'
        );
        await manager.cardToggle('Rain jacket', 'Show').click();
        await expect(manager.cell('Rain jacket', 'English')).toBeVisible();
        await expect(manager.cell('Winter boots', 'Deutsch')).toBeHidden();

        await manager.toggleAll('Expand all').click();
        await expect(manager.cell('Winter boots', 'Deutsch')).toBeVisible();
    });

    test('says what to do when opened on nothing', async ({
        page,
        publishManagerPage: manager
    }) => {
        await page.goto(`/workspaces/${I18N_WORKSPACE.id}/publish`);
        await expect(manager.heading).toBeVisible();
        await expect(
            page.getByText('Nothing to publish here yet.', { exact: false })
        ).toBeVisible();
    });

    test('the page has no a11y violations', async ({
        publishManagerPage: manager,
        makeAxe
    }) => {
        await manager.goto(I18N_WORKSPACE.id, 'localized_post', [
            'lp-en-1',
            'lp-en-2'
        ]);
        await expect(manager.publish).toBeEnabled();
        await expectNoA11yViolations(makeAxe());
    });
});

test.describe('Publish Manager — what each locale is missing', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [I18N_WORKSPACE]);
        // The German boots is missing its (translated) title.
        await mockI18n(page, {
            blocked: {
                'lp-de-1': [
                    { field: 'title', label: 'Title', message: 'is required' }
                ]
            }
        });
        await mockReviewStatus(page, {});
    });

    test('shows the failing fields per locale, and every field on demand', async ({
        publishManagerPage: manager,
        makeAxe
    }) => {
        await manager.goto(I18N_WORKSPACE.id, 'localized_post', [
            'lp-en-1',
            'lp-en-2'
        ]);
        await expect(manager.summary).toHaveText(
            '2 picked · 1 ready to publish · 1 needs fixes'
        );
        await expect(manager.card('Winter boots')).toContainText(
            '1 entry needs fixes'
        );

        // The failure is on screen without asking, and the title is marked as
        // a field translated per locale.
        const failing = manager.failing('Winter boots, Deutsch');
        await expect(failing).toContainText('Title');
        await expect(failing).toContainText('is required');
        await expect(failing).toContainText('(translated per locale)');
        await expect(failing).not.toContainText('Category');

        // The whole checklist, passing fields included, folds open.
        await manager.allChecks('Winter boots, Deutsch').click();
        await expect(manager.card('Winter boots')).toContainText('Category');

        // Only the ready entry is offered for publishing.
        await expect(manager.publish).toHaveText('Publish 1 entry');
        await expectNoA11yViolations(makeAxe());
    });
});
