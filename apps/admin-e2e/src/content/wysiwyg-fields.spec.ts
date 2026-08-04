import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    WYSIWYG_WORKSPACE,
    WYSIWYG_SCHEMA_SEED,
    WYSIWYG_DETAIL_SEED,
    WYSIWYG_ENTRY_ID,
    WYSIWYG_ENTRY_BODY,
    mockContentSchema,
    mockContentSchemaDetail,
    mockContentEntries,
    mockContentEntryWrites,
    mockContentEntryRead,
    spyEntrySave,
    type EntrySaveSpy
} from '../support/api/content';
import { expectNoA11yViolations } from '../support/a11y';

const WS = WYSIWYG_WORKSPACE.id;

/**
 * The **rich-text field** (`@ortha-cms/wysiwyg-admin`, contributed through
 * content-admin's `ENTRY_FIELD_CONTROL_SLOT`): the entry form shows what was
 * written rather than the HTML behind it, pressing it opens the TipTap editor,
 * and everything the toolbar does ends up in the saved value.
 *
 * The save spy is the point of most of these — the visible editor is only half
 * the feature; what gets *stored* is the other half, and only the request body
 * shows that.
 */
test.describe('Entry editor — rich text field', () => {
    let saves: EntrySaveSpy;

    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [WYSIWYG_WORKSPACE]);
        await mockContentSchema(page, { types: WYSIWYG_SCHEMA_SEED });
        await mockContentSchemaDetail(page, { details: WYSIWYG_DETAIL_SEED });
        await mockContentEntries(page, {
            details: WYSIWYG_DETAIL_SEED,
            entries: { article: [] }
        });
        await mockContentEntryWrites(page, { details: WYSIWYG_DETAIL_SEED });
        // After the write mock, so the read-one serves our HTML rather than the
        // value the write mock fabricates from the schema.
        await mockContentEntryRead(page, {
            records: {
                [`article/${WYSIWYG_ENTRY_ID}`]: {
                    title: 'Release 2.0',
                    body: WYSIWYG_ENTRY_BODY,
                    summary: '<p>Short and sweet.</p>',
                    rawHtml: '<div class="legacy">kept as-is</div>'
                }
            }
        });
        saves = await spyEntrySave(page);
    });

    test.describe('the collapsed field', () => {
        test('renders stored HTML as content, not markup', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoArticle(WS, WYSIWYG_ENTRY_ID);

            // The heading, the emphasis, and the list items all survive as real
            // elements — the whole reason the field isn't a textarea.
            const preview = wysiwygFieldPage.preview('Body');
            await expect(
                preview.getByRole('heading', { name: 'Release notes' })
            ).toBeVisible();
            await expect(preview.getByRole('list')).toBeVisible();
            await expect(
                preview.getByRole('listitem').filter({ hasText: 'Cold start' })
            ).toBeVisible();
            // …and no tags leaked through as text.
            await expect(preview).not.toContainText('<strong>');
        });

        test('offers no link to fall into on the way to the editor', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoArticle(WS, WYSIWYG_ENTRY_ID);
            // The control is a button laid over the preview; a live anchor
            // underneath would be a tab stop hidden beneath it, and pressing it
            // would navigate out of the record.
            await expect(
                wysiwygFieldPage.preview('Body').getByRole('link')
            ).toHaveCount(0);
        });

        test('shows the field placeholder while empty', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await expect(
                wysiwygFieldPage.preview('Body')
            ).toContainText('Tell the story…');
        });

        test('keeps a plain textarea for a field that opted out', async ({
            wysiwygFieldPage,
            contentLibraryPage
        }) => {
            await wysiwygFieldPage.gotoArticle(WS, WYSIWYG_ENTRY_ID);

            // `admin: { widget: 'textarea' }` — the escape hatch for a body that
            // is hand-maintained markup, which a WYSIWYG would reformat.
            await expect(
                contentLibraryPage.fieldTextbox('Raw HTML')
            ).toHaveValue('<div class="legacy">kept as-is</div>');
            await expect(wysiwygFieldPage.control('Raw HTML')).toHaveCount(0);
        });
    });

    test.describe('the editor dialog', () => {
        test('opens on the field with the caret already in the text', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoArticle(WS, WYSIWYG_ENTRY_ID);
            await wysiwygFieldPage.open('Body');

            await expect(wysiwygFieldPage.dialog).toBeVisible();
            await expect(
                wysiwygFieldPage.dialog.getByRole('heading', { name: 'Body' })
            ).toBeVisible();
            // Focus lands in the document, not on the ✕ — the author pressed
            // this to write.
            await expect(wysiwygFieldPage.surface('Body')).toBeFocused();
        });

        test('writes edits back to the form as they are made', async ({
            wysiwygFieldPage,
            contentLibraryPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await contentLibraryPage.fieldTextbox('Title').fill('Draft');

            await wysiwygFieldPage.open('Body');
            await wysiwygFieldPage.type('Hello there');
            await wysiwygFieldPage.done();

            // Back on the form, the preview already shows it — nothing is
            // "committed" by closing, so every way out of the dialog is safe.
            await expect(wysiwygFieldPage.preview('Body')).toContainText(
                'Hello there'
            );
        });

        test('stores the formatting the toolbar applied', async ({
            wysiwygFieldPage,
            contentLibraryPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await contentLibraryPage.fieldTextbox('Title').fill('Draft');

            await wysiwygFieldPage.open('Body');
            await wysiwygFieldPage.toolbarButton('Bold').click();
            await wysiwygFieldPage.type('Loud');
            await wysiwygFieldPage.toolbarButton('Bold').click();
            await wysiwygFieldPage.type(' and quiet');
            await wysiwygFieldPage.done();

            // Saved as a **draft**: the type is publishable and `summary` is
            // required, so the primary action would be blocked by a field this
            // test isn't about.
            await contentLibraryPage.saveDraft();
            await expect.poll(() => saves.bodies).toHaveLength(1);

            expect(saves.bodies[0].values?.['body']).toBe(
                '<p><strong>Loud</strong> and quiet</p>'
            );
        });

        test('stores a callout as semantic HTML, not admin classes', async ({
            wysiwygFieldPage,
            contentLibraryPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await contentLibraryPage.fieldTextbox('Title').fill('Draft');

            await wysiwygFieldPage.open('Body');
            await wysiwygFieldPage.type('Mind the gap');
            await wysiwygFieldPage.openToolbarMenu('Callout');
            await wysiwygFieldPage.menuItem('Warning').click();
            await wysiwygFieldPage.done();

            await contentLibraryPage.saveDraft();
            await expect.poll(() => saves.bodies).toHaveLength(1);

            // The tone travels as data, so whatever renders this HTML styles it
            // itself — no admin styling leaks into published content. The
            // trailing paragraph is the editor's own: a document ending in a
            // callout would otherwise have nowhere left to type.
            expect(saves.bodies[0].values?.['body']).toBe(
                '<aside data-tone="warning" data-callout=""><p>Mind the gap</p></aside><p></p>'
            );
        });

        test('stores a table with its header row', async ({
            wysiwygFieldPage,
            contentLibraryPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await contentLibraryPage.fieldTextbox('Title').fill('Draft');

            await wysiwygFieldPage.open('Body');
            await wysiwygFieldPage.openToolbarMenu('Table');
            await wysiwygFieldPage.menuItem('Insert table').click();
            await expect(
                wysiwygFieldPage.dialog.getByRole('table')
            ).toBeVisible();
            await wysiwygFieldPage.done();

            await contentLibraryPage.saveDraft();
            await expect.poll(() => saves.bodies).toHaveLength(1);

            // A resizable table carries its own column sizing, so match the
            // structure rather than an exact string.
            const body = String(saves.bodies[0].values?.['body']);
            expect(body).toContain('<table');
            expect(body).toContain('<th');
            expect(body.match(/<tr>/g)).toHaveLength(3);
        });

        test('stores a column layout as nested divs', async ({
            wysiwygFieldPage,
            contentLibraryPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await contentLibraryPage.fieldTextbox('Title').fill('Draft');

            await wysiwygFieldPage.open('Body');
            await wysiwygFieldPage.openToolbarMenu('Columns');
            await wysiwygFieldPage.menuRadio('3 columns').click();
            await wysiwygFieldPage.done();

            await contentLibraryPage.saveDraft();
            await expect.poll(() => saves.bodies).toHaveLength(1);

            const body = String(saves.bodies[0].values?.['body']);
            expect(body).toContain('data-columns="3"');
            expect(body.match(/data-column=""/g)).toHaveLength(3);
        });

        test('stores an emptied field as empty, not as a blank paragraph', async ({
            wysiwygFieldPage,
            contentLibraryPage
        }) => {
            await wysiwygFieldPage.gotoArticle(WS, WYSIWYG_ENTRY_ID);

            // `summary` is required, so an emptied editor has to read as empty
            // — an `<p></p>` would sail past the rule and publish a blank field.
            await wysiwygFieldPage.open('Summary');
            await wysiwygFieldPage.clearAll();
            await wysiwygFieldPage.done();

            await contentLibraryPage.editorSave.click();
            await expect(wysiwygFieldPage.fieldError('summary')).toHaveText(
                'Required'
            );
            expect(saves.bodies).toHaveLength(0);
        });
    });

    test.describe('accessibility', () => {
        test('the collapsed field has no violations', async ({
            wysiwygFieldPage,
            makeAxe
        }) => {
            await wysiwygFieldPage.gotoArticle(WS, WYSIWYG_ENTRY_ID);
            await wysiwygFieldPage.control('Body').waitFor();
            await expectNoA11yViolations(makeAxe());
        });

        test('the open editor dialog has no violations', async ({
            wysiwygFieldPage,
            makeAxe
        }) => {
            await wysiwygFieldPage.gotoArticle(WS, WYSIWYG_ENTRY_ID);
            await wysiwygFieldPage.open('Body');
            await expectNoA11yViolations(makeAxe());
        });

        test('the field is reachable and openable from the keyboard', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoArticle(WS, WYSIWYG_ENTRY_ID);
            await wysiwygFieldPage.openWithKeyboard('Body');

            await expect(wysiwygFieldPage.dialog).toBeVisible();
            await expect(wysiwygFieldPage.surface('Body')).toBeFocused();
        });
    });
});
