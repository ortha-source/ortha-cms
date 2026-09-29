import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import type { RelationsEditorPage } from '../support/pages/RelationsEditorPage';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    HIDDEN_FIELD_DETAIL_SEED,
    HIDDEN_FIELD_SCHEMA_SEED,
    HIDDEN_FIELD_WORKSPACE,
    RELATIONS_DETAIL_SEED,
    RELATIONS_ENTRIES_SEED,
    RELATIONS_SCHEMA_SEED,
    RELATIONS_WORKSPACE,
    mockContentEntryRead,
    mockContentSchema,
    mockContentSchemaDetail,
    mockContentEntries,
    mockContentEntryWrites,
    mockEntryMedia,
    mockEntryRelations,
    mockPublishRejection,
    mockRelationFieldLinks,
    spyEntrySave,
    type EntrySaveSpy
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

/** The tag the relation specs below stage, as the relations read returns it. */
const ENGINEERING = { id: 'tag-01', title: 'engineering', slug: 'engineering' };
/** The stored article the relations seed provides an editor for. */
const ARTICLE = RELATIONS_ENTRIES_SEED['article'][1].id;

/**
 * A refused publish after a **landed** save, seen from the Relations tab.
 *
 * The save carries the staged links as a delta and writes them — so once it has
 * landed, those links are the record's, and the tab has to say so: the saved
 * set on screen and nothing marked Changed. The staging used to be cleared only
 * when the whole submit resolved, so a publish refused after the save left
 * every link the author had just saved marked as unsaved — and the next Save
 * sent the same delta again.
 */
test.describe('Entry editor: staged links across a refused publish', () => {
    let saves: EntrySaveSpy;

    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [RELATIONS_WORKSPACE]);
        await mockContentSchema(page, { types: RELATIONS_SCHEMA_SEED });
        await mockContentSchemaDetail(page, { details: RELATIONS_DETAIL_SEED });
        await mockContentEntries(page, {
            details: RELATIONS_DETAIL_SEED,
            entries: RELATIONS_ENTRIES_SEED
        });
        await mockContentEntryWrites(page, { details: RELATIONS_DETAIL_SEED });
        await mockEntryRelations(page);
        await mockRelationFieldLinks(page);
        await mockEntryMedia(page);
        await mockContentEntryRead(page, {
            records: {
                [`article/${ARTICLE}`]: {
                    text: 'Scaling Postgres',
                    author: null,
                    seo: null
                }
            }
        });
        await mockNewEntryProtection(page, { protected: false });
        await mockEntryReview(page, UNPROTECTED);
        saves = await spyEntrySave(page);
    });

    /** Stage one tag on the open editor's Relations tab. */
    async function stageEngineering(relationsEditorPage: RelationsEditorPage) {
        await relationsEditorPage.openRelationsTab();
        await relationsEditorPage.addRelatedButton.click();
        await relationsEditorPage.candidate('engineering').click();
        await relationsEditorPage.addSelectedButton.click();
        await expect(relationsEditorPage.changedBadge.first()).toBeVisible();
    }

    /**
     * From here on the server holds the link — what the relations read of the
     * saved record answers once the save's refresh asks it again.
     */
    async function serverHoldsEngineering(page: Page, id: string) {
        await mockEntryRelations(page, {
            relations: { [`article/${id}`]: { tags: [ENGINEERING] } }
        });
        // The per-field page the Tags card lists its links from.
        await mockRelationFieldLinks(page, {
            links: { 'article/tags': [ENGINEERING] }
        });
    }

    test('a new record’s saved links are not left staged', async ({
        page,
        contentLibraryPage,
        relationsEditorPage
    }) => {
        await mockPublishRejection(page, { field: 'internalCode' });
        await relationsEditorPage.gotoNewArticle(RELATIONS_WORKSPACE.id);
        await contentLibraryPage
            .fieldTextbox('Title', { exact: true })
            .fill('A new article');
        await stageEngineering(relationsEditorPage);
        await serverHoldsEngineering(page, 'article-new');

        await contentLibraryPage.editorSave.first().click();

        await expect(
            contentLibraryPage.toast(/The server refused “internalCode”/)
        ).toBeVisible();
        await expect(page).toHaveURL(/\/content\/article\/article-new\//);
        // The create carried the link …
        expect(saves.bodies).toHaveLength(1);
        expect(saves.bodies[0].relations?.tags?.link).toEqual(['tag-01']);
        // … so the tab shows it as saved, not as a pending change.
        await expect(
            relationsEditorPage.assignedRemove('engineering')
        ).toBeVisible();
        await expect(relationsEditorPage.changedBadge).toHaveCount(0);
    });

    test('an existing record’s saved links are not left staged', async ({
        page,
        contentLibraryPage,
        relationsEditorPage
    }) => {
        await mockPublishRejection(page, { field: 'internalCode' });
        await contentLibraryPage.gotoEntry(
            RELATIONS_WORKSPACE.id,
            'article',
            ARTICLE
        );
        await stageEngineering(relationsEditorPage);
        await serverHoldsEngineering(page, ARTICLE);

        await contentLibraryPage.editorSave.first().click();

        await expect(
            contentLibraryPage.toast(/The server refused “internalCode”/)
        ).toBeVisible();
        expect(saves.bodies).toHaveLength(1);
        expect(saves.bodies[0].relations?.tags?.link).toEqual(['tag-01']);
        await expect(
            relationsEditorPage.assignedRemove('engineering')
        ).toBeVisible();
        await expect(relationsEditorPage.changedBadge).toHaveCount(0);
    });

    test('a successful publish leaves nothing staged either', async ({
        page,
        contentLibraryPage,
        relationsEditorPage
    }) => {
        await relationsEditorPage.gotoNewArticle(RELATIONS_WORKSPACE.id);
        await contentLibraryPage
            .fieldTextbox('Title', { exact: true })
            .fill('A new article');
        await stageEngineering(relationsEditorPage);
        await serverHoldsEngineering(page, 'article-new');

        await contentLibraryPage.editorSave.first().click();

        await expect(
            contentLibraryPage.toast('Articles published.')
        ).toBeVisible();
        await expect(
            relationsEditorPage.assignedRemove('engineering')
        ).toBeVisible();
        await expect(relationsEditorPage.changedBadge).toHaveCount(0);
    });

    test('a save that never landed keeps the links staged', async ({
        page,
        contentLibraryPage,
        relationsEditorPage
    }) => {
        await page.route(/\/api\/content\/article(\?.*)?$/, (route) =>
            route.request().method() === 'POST'
                ? route.fulfill({
                      status: 400,
                      contentType: 'application/json',
                      body: JSON.stringify({ message: 'Boom' })
                  })
                : route.fallback()
        );
        await relationsEditorPage.gotoNewArticle(RELATIONS_WORKSPACE.id);
        await contentLibraryPage
            .fieldTextbox('Title', { exact: true })
            .fill('A new article');
        await stageEngineering(relationsEditorPage);

        await contentLibraryPage.editorSave.first().click();

        await expect(
            contentLibraryPage.toast('Not published: Boom')
        ).toBeVisible();
        await expect(page).toHaveURL(/\/content\/article\/new\//);
        await expect(relationsEditorPage.changedBadge.first()).toBeVisible();
    });
});
