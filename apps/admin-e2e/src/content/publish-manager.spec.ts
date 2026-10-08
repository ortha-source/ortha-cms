import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    I18N_WORKSPACE,
    mockI18n,
    spyEntryWrites,
    type EntryWrite,
    type I18nMockOptions
} from '../support/api/i18n';
import {
    mockReviewStatus,
    type ReviewStatusSeed
} from '../support/api/publishing';
import { expectNoA11yViolations } from '../support/a11y';
import { type ContentLibraryPage } from '../support/pages/ContentLibraryPage';

/**
 * The **Publish Manager** (`@orthacms/publishing-admin`) — publishing a set of
 * records together with their translations and the drafts they link to. The
 * seed (`mockI18n`), in the default English list:
 *
 * - **Winter boots** — English live, German **Modified**.
 * - **Rain jacket** — an English draft; it links a draft tag, **Outerwear**,
 *   through its Tags field.
 *
 * So everything that can publish is three entries: the German boots (a
 * translation), the English jacket (selected) and the tag (a linked draft).
 * The live English boots is not a decision, so the page does not show it.
 */

const LINKED: I18nMockOptions['linked'] = {
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
};

const HELD: ReviewStatusSeed = {
    protected: true,
    required: 1,
    given: 0,
    stale: 0,
    requested: true,
    blocked: true
};

test.describe('Publish Manager', () => {
    let writes: EntryWrite[];

    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [I18N_WORKSPACE]);
        await mockI18n(page, { linked: LINKED });
        await mockReviewStatus(page, {});
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

        // Everything that can publish starts picked…
        await expect(manager.cell('Winter boots', 'Deutsch')).toBeChecked();
        await expect(manager.cell('Rain jacket', 'English')).toBeChecked();
        await expect(manager.recordToggle('Outerwear')).toBeChecked();
        // …the live English boots is not shown at all…
        await expect(manager.cell('Winter boots', 'English')).toHaveCount(0);
        // …and the linked draft says where it came from.
        await expect(manager.list('Linked drafts')).toContainText(
            'tag · via Tags on “Rain jacket”'
        );
        // Only the locales with something to publish get a chip.
        await expect(manager.axisToggle('English')).toBeVisible();
        await expect(manager.axisToggle('Deutsch')).toBeVisible();
        await expect(manager.axisToggle('Français')).toHaveCount(0);
        // A clean set has no attention list.
        await expect(manager.attention).toHaveCount(0);

        await expect(manager.summary).toHaveText('3 of 3 picked');
        await manager.publish.click();
        await expect(manager.outcome).toContainText('3 entries published');

        // Dependencies first: the tag goes out before the records linking it.
        expect(committedBatches()).toEqual([['tag-1'], ['lp-de-1', 'lp-en-2']]);
    });

    test('picks per locale, per record and per entry', async ({
        publishManagerPage: manager
    }) => {
        await manager.goto(I18N_WORKSPACE.id, 'localized_post', [
            'lp-en-1',
            'lp-en-2'
        ]);
        await expect(manager.summary).toHaveText('3 of 3 picked');

        // German off for every record, from its chip.
        await manager.axisToggle('Deutsch').click();
        await expect(manager.cell('Winter boots', 'Deutsch')).not.toBeChecked();
        // The jacket off as a whole record, the tag off as well.
        await manager.recordToggle('Rain jacket').click();
        await manager.recordToggle('Outerwear').click();
        await expect(manager.summary).toHaveText('Nothing picked');
        await expect(manager.publish).toBeDisabled();
        // One locale pill back on.
        await manager.cell('Winter boots', 'Deutsch').click();
        await expect(manager.summary).toHaveText('1 of 3 picked');
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
        await expect(manager.summary).toHaveText('1 of 1 picked');
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

test.describe('Publish Manager — what needs attention', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [I18N_WORKSPACE]);
        // The German boots is missing its (translated) title; the jacket is
        // held by an approval rule.
        await mockI18n(page, {
            linked: LINKED,
            blocked: {
                'lp-de-1': [
                    { field: 'title', label: 'Title', message: 'is required' }
                ]
            }
        });
        await mockReviewStatus(page, { 'lp-en-2': HELD });
    });

    test('names what a locale is missing, and never offers it', async ({
        publishManagerPage: manager,
        makeAxe
    }) => {
        await manager.goto(I18N_WORKSPACE.id, 'localized_post', [
            'lp-en-1',
            'lp-en-2'
        ]);
        await expect(manager.summary).toHaveText(
            '2 of 2 picked · 2 need attention'
        );
        // The blocked German boots is a red pill, not a checkbox…
        await expect(manager.cell('Winter boots', 'Deutsch')).toHaveCount(0);
        await expect(manager.list('Localized posts')).toContainText(
            'Deutsch: needs fixes before it can publish'
        );
        // …and the attention list says why, the translated field marked.
        await expect(manager.attention).toContainText(
            'Winterstiefel · Deutsch'
        );
        await expect(manager.attention).toContainText('Title is required');
        await expect(manager.attention).toContainText(
            '(translated per locale)'
        );
        // The held jacket stays pickable; the rule decides at publish.
        await expect(manager.cell('Rain jacket', 'English')).toBeChecked();
        await expect(manager.attention).toContainText('Approvals 0/1');

        await expect(manager.publish).toHaveText('Publish 2 entries');
        await expectNoA11yViolations(makeAxe());
    });
});
