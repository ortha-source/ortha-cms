import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    HIDDEN_FIELD_DETAIL_SEED,
    HIDDEN_FIELD_SCHEMA_SEED,
    HIDDEN_FIELD_WORKSPACE,
    mockContentSchema,
    mockContentSchemaDetail,
    mockContentEntries,
    mockContentEntryWrites,
    mockEntryMedia,
    mockEntryRelations,
    mockPublishRejection
} from '../support/api/content';
import {
    UNPROTECTED,
    mockEntryReview,
    mockNewEntryProtection
} from '../support/api/protection';

const WS = HIDDEN_FIELD_WORKSPACE.id;
const TYPE = 'gadget';
/** The id the write mock gives a created `gadget`. */
const CREATED_ID = `${TYPE}-new`;

/**
 * **Publish on a brand-new record** is two writes: a create, then a publish of
 * the row it made. The create can land while the publish is refused — the
 * server's gate 422s on a field the editor renders nowhere — and the editor then
 * holds a saved draft it has to go on showing.
 *
 * It used to show an empty form instead: the landed create re-armed the form's
 * seeding, but the view was still on `/new`, whose seed is a blank form, and
 * the move to the record's own URL only happened on full success. So the draft
 * was saved and every field on screen read empty.
 */
test.describe('Entry editor: publishing a new record', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockContentSchema(page, { types: HIDDEN_FIELD_SCHEMA_SEED });
        await mockContentSchemaDetail(page, {
            details: HIDDEN_FIELD_DETAIL_SEED
        });
        await mockContentEntries(page, { details: HIDDEN_FIELD_DETAIL_SEED });
        await mockContentEntryWrites(page, {
            details: HIDDEN_FIELD_DETAIL_SEED
        });
        // The saved record's own reads, which every write refreshes — left to
        // the write mock they answer with a record, fail to parse, and retry
        // under the busy cover.
        await mockEntryRelations(page);
        await mockEntryMedia(page);
        await mockWorkspaces(page, [HIDDEN_FIELD_WORKSPACE]);
        // No publication rule: the create form's outlook and the saved
        // record's review both say so, so no guard stands between Publish and
        // the write under test.
        await mockNewEntryProtection(page, { protected: false });
        await mockEntryReview(page, UNPROTECTED);
    });

    test('a refused publish keeps the saved draft on screen, at its own URL', async ({
        page,
        contentLibraryPage
    }) => {
        await mockPublishRejection(page, { field: 'internalCode' });
        await contentLibraryPage.gotoNewEntry(WS, TYPE);

        const title = contentLibraryPage.fieldTextbox('Title', {
            exact: true
        });
        await title.fill('A gadget');
        await contentLibraryPage.editorSave.first().click();

        // The unmapped-issue toast still says why the publish did not go through.
        await expect(
            contentLibraryPage.toast(/The server refused “internalCode”/)
        ).toBeVisible();
        // The draft exists, so the editor is on it — a retry updates this row
        // rather than creating a second one.
        await expect(page).toHaveURL(
            new RegExp(`/content/${TYPE}/${CREATED_ID}$`)
        );
        await expect(contentLibraryPage.viewHeading('Gadgets')).toBeVisible();
        // And what the author typed is still what the form holds.
        await expect(title).toHaveValue('A gadget');
    });

    test('a successful publish shows the record it saved', async ({
        page,
        contentLibraryPage
    }) => {
        await contentLibraryPage.gotoNewEntry(WS, TYPE);

        const title = contentLibraryPage.fieldTextbox('Title', {
            exact: true
        });
        await title.fill('A gadget');
        await contentLibraryPage.editorSave.first().click();

        await expect(
            contentLibraryPage.toast('Gadgets published.')
        ).toBeVisible();
        await expect(page).toHaveURL(
            new RegExp(`/content/${TYPE}/${CREATED_ID}$`)
        );
        await expect(title).toHaveValue('A gadget');
    });

    test('publishing an existing record keeps its edited values', async ({
        page,
        contentLibraryPage
    }) => {
        await contentLibraryPage.gotoEntry(WS, TYPE, `${TYPE}-01`);

        const title = contentLibraryPage.fieldTextbox('Title', {
            exact: true
        });
        await expect(title).toHaveValue('Title 01');
        await title.fill('Renamed gadget');
        await contentLibraryPage.editorSave.first().click();

        await expect(
            contentLibraryPage.toast('Gadgets published.')
        ).toBeVisible();
        await expect(page).toHaveURL(
            new RegExp(`/content/${TYPE}/${TYPE}-01$`)
        );
        await expect(title).toHaveValue('Renamed gadget');
    });

    test('a refused publish of an existing record keeps its edited values', async ({
        page,
        contentLibraryPage
    }) => {
        await mockPublishRejection(page, { field: 'internalCode' });
        await contentLibraryPage.gotoEntry(WS, TYPE, `${TYPE}-01`);

        const title = contentLibraryPage.fieldTextbox('Title', {
            exact: true
        });
        await expect(title).toHaveValue('Title 01');
        await title.fill('Renamed gadget');
        await contentLibraryPage.editorSave.first().click();

        await expect(
            contentLibraryPage.toast(/The server refused “internalCode”/)
        ).toBeVisible();
        await expect(page).toHaveURL(
            new RegExp(`/content/${TYPE}/${TYPE}-01$`)
        );
        await expect(title).toHaveValue('Renamed gadget');
    });
});
