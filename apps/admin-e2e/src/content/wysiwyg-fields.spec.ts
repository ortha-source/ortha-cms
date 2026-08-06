import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    WYSIWYG_WORKSPACE,
    WYSIWYG_SCHEMA_SEED,
    WYSIWYG_DETAIL_SEED,
    WYSIWYG_ENTRY_ID,
    WYSIWYG_ENTRY_BODY,
    WYSIWYG_MEDIA_ENTRY_ID,
    WYSIWYG_MEDIA_ENTRY_BODY,
    mockContentSchema,
    mockContentSchemaDetail,
    mockContentEntries,
    mockContentEntryWrites,
    mockContentEntryRead,
    spyEntrySave,
    type EntrySaveSpy
} from '../support/api/content';
import {
    mockMediaApi,
    MEDIA_ASSET_IDS,
    MEDIA_HERO_ALT,
    type MediaUploadSpy
} from '../support/api/media';
import { expectNoA11yViolations } from '../support/a11y';

const WS = WYSIWYG_WORKSPACE.id;

/**
 * The **rich-text field** (`@ortha-cms/wysiwyg-admin`, contributed through
 * content-admin's `ENTRY_FIELD_CONTROL_SLOT`): the entry form shows what was
 * written rather than the HTML behind it, pressing it expands the TipTap editor
 * into the work area, and everything the toolbar does ends up in the saved
 * value.
 *
 * The save spy is the point of most of these — the visible editor is only half
 * the feature; what gets *stored* is the other half, and only the request body
 * shows that.
 */
test.describe('Entry editor — rich text field', () => {
    let saves: EntrySaveSpy;
    let uploads: MediaUploadSpy;

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
                },
                [`article/${WYSIWYG_MEDIA_ENTRY_ID}`]: {
                    title: 'With media',
                    body: WYSIWYG_MEDIA_ENTRY_BODY,
                    summary: '<p>Short and sweet.</p>',
                    rawHtml: ''
                }
            }
        });
        saves = await spyEntrySave(page);
        // The Media Library sources come from `@ortha-cms/media-admin` through
        // the editor's own slot, so the media endpoints have to answer too.
        uploads = await mockMediaApi(page);
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
            await expect(wysiwygFieldPage.preview('Body')).toContainText(
                'Tell the story…'
            );
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

    test.describe('the expanded editor', () => {
        test('takes over the work area with the caret already in the text', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoArticle(WS, WYSIWYG_ENTRY_ID);
            await wysiwygFieldPage.open('Body');

            await expect(
                wysiwygFieldPage.expandedHeading('Body')
            ).toBeVisible();
            // The form it replaced is gone, not merely covered — this is a view
            // swap, so the tab strip and the other fields have unmounted.
            await expect(wysiwygFieldPage.editorTabs).toBeHidden();
            await expect(wysiwygFieldPage.control('Summary')).toHaveCount(0);
            // Focus lands in the document — the author pressed this to write.
            await expect(wysiwygFieldPage.surface('Body')).toBeFocused();
        });

        test('keeps the record and its chrome on screen', async ({
            wysiwygFieldPage,
            contentLibraryPage
        }) => {
            await wysiwygFieldPage.gotoArticle(WS, WYSIWYG_ENTRY_ID);
            await wysiwygFieldPage.open('Body');

            // The whole point of expanding into the work area rather than
            // opening a modal: everything around the field keeps working.
            await expect(wysiwygFieldPage.contentNav).toBeVisible();
            await expect(wysiwygFieldPage.propertiesPanel).toBeVisible();
            await expect(contentLibraryPage.editorSave).toBeVisible();
            // …including which record is being edited.
            await expect(
                contentLibraryPage.viewHeading('Articles')
            ).toBeVisible();
        });

        test('keeps the toolbar on a single row', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoArticle(WS, WYSIWYG_ENTRY_ID);
            await wysiwygFieldPage.open('Body');

            // Twenty flat controls wrapped onto a second line at ordinary
            // widths, pushing everything below them down. The bar now folds
            // marks, alignment, and block insertion into three menus to fit.
            expect(await wysiwygFieldPage.toolbarRowCount()).toBe(1);
        });

        test('returns to the form from either exit', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoArticle(WS, WYSIWYG_ENTRY_ID);

            await wysiwygFieldPage.open('Body');
            await wysiwygFieldPage.backToFields();
            await expect(wysiwygFieldPage.editorTabs).toBeVisible();
            await expect(wysiwygFieldPage.control('Body')).toBeVisible();

            await wysiwygFieldPage.open('Body');
            await wysiwygFieldPage.done();
            await expect(wysiwygFieldPage.editorTabs).toBeVisible();
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
            // "committed" by collapsing, so leaving the view is always safe.
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
            await wysiwygFieldPage.openInsertSubmenu('Callout');
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
            await wysiwygFieldPage.openInsertSubmenu('Table');
            await wysiwygFieldPage.menuItem('Insert table').click();
            await expect(wysiwygFieldPage.editorTable).toBeVisible();
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
            await wysiwygFieldPage.openInsertSubmenu('Columns');
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

    test.describe('media', () => {
        test('offers the contributed sources beside the built-in URL entries', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoArticle(WS, WYSIWYG_ENTRY_ID);
            await wysiwygFieldPage.open('Body');
            await wysiwygFieldPage.openInsertSubmenu('Media');

            // The first two are the media plugin's `WYSIWYG_MEDIA_SLOT`
            // contributions — the editor itself knows nothing about a library.
            await expect(
                wysiwygFieldPage.menuItem('Media Library…')
            ).toBeVisible();
            await expect(
                wysiwygFieldPage.menuItem('Upload files…')
            ).toBeVisible();
            // …and the editor's own entries, which need no plugin at all.
            await expect(
                wysiwygFieldPage.menuItem('Image from a URL…')
            ).toBeVisible();
            await expect(
                wysiwygFieldPage.menuItem('Video from a URL…')
            ).toBeVisible();
        });

        test('stores an image named by URL', async ({
            wysiwygFieldPage,
            contentLibraryPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await contentLibraryPage.fieldTextbox('Title').fill('Draft');

            await wysiwygFieldPage.open('Body');
            await wysiwygFieldPage.openMediaSource('Image from a URL…');
            await wysiwygFieldPage.fillMediaUrl(
                'https://example.com/photo.jpg',
                'A photo'
            );

            // Asserted on the node, not on the paint: the URL is external and
            // this suite has no network, so the image is broken and has no box.
            // What matters is that the editor made a node carrying that source.
            await expect(
                wysiwygFieldPage.editorImage('A photo')
            ).toHaveAttribute('src', 'https://example.com/photo.jpg');

            await wysiwygFieldPage.done();
            await contentLibraryPage.saveDraft();
            await expect.poll(() => saves.bodies).toHaveLength(1);

            const body = String(saves.bodies[0].values?.['body']);
            expect(body).toContain(
                '<img src="https://example.com/photo.jpg" alt="A photo">'
            );
        });

        test('refuses a URL the editor would not publish', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoArticle(WS, WYSIWYG_ENTRY_ID);
            await wysiwygFieldPage.open('Body');
            await wysiwygFieldPage.openMediaSource('Image from a URL…');

            // `javascript:` never reaches the document — the dialog says why
            // rather than inserting a node that would carry it into published
            // HTML.
            await wysiwygFieldPage.fillMediaUrl('javascript:alert(1)');
            await expect(wysiwygFieldPage.mediaUrlError).toBeVisible();
            await expect(wysiwygFieldPage.editorImage(/./)).toHaveCount(0);
        });

        test('places an asset picked from the Media Library', async ({
            wysiwygFieldPage,
            contentLibraryPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await contentLibraryPage.fieldTextbox('Title').fill('Draft');

            await wysiwygFieldPage.open('Body');
            await wysiwygFieldPage.openMediaSource('Media Library…');
            await wysiwygFieldPage.pickLibraryAsset('hero.png');

            await wysiwygFieldPage.done();
            await contentLibraryPage.saveDraft();
            await expect.poll(() => saves.bodies).toHaveLength(1);

            // The stored `src` points at the library asset, and the asset's own
            // pixel width seeds the node — so it lands at its natural size.
            const body = String(saves.bodies[0].values?.['body']);
            expect(body).toContain(`/api/media/assets/${MEDIA_ASSET_IDS.hero}`);
            expect(body).toContain('<img ');
            expect(body).toContain('width="1200"');
            // Nothing was uploaded: an existing asset is already in the library.
            expect(uploads.count).toBe(0);
        });

        test('resizes an image from the keyboard, and stores the width', async ({
            wysiwygFieldPage,
            contentLibraryPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await contentLibraryPage.fieldTextbox('Title').fill('Draft');

            await wysiwygFieldPage.open('Body');
            await wysiwygFieldPage.openMediaSource('Image from a URL…');
            await wysiwygFieldPage.fillMediaUrl(
                'https://example.com/photo.jpg',
                'A photo'
            );

            // Resizing is a content decision — the width is published — so it
            // has to work without a mouse.
            await wysiwygFieldPage.nudgeResize('ArrowLeft', 2);

            await wysiwygFieldPage.done();
            await contentLibraryPage.saveDraft();
            await expect.poll(() => saves.bodies).toHaveLength(1);

            expect(String(saves.bodies[0].values?.['body'])).toMatch(
                /<img[^>]*width="\d+"/
            );
        });

        test('prompts for alt text, and stores what the author writes', async ({
            wysiwygFieldPage,
            contentLibraryPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await contentLibraryPage.fieldTextbox('Title').fill('Draft');

            await wysiwygFieldPage.open('Body');
            await wysiwygFieldPage.openMediaSource('Image from a URL…');
            // Inserted with **no** alt — the case an upload always lands in,
            // and the one the insert dialogs can't cover on their own.
            await wysiwygFieldPage.fillMediaUrl(
                'https://example.com/photo.jpg'
            );

            // The prompt is the control: the defect is visible while writing,
            // not discovered in an audit.
            await expect(
                wysiwygFieldPage.altControl('Add alt text')
            ).toBeVisible();

            await wysiwygFieldPage.setAltText('Ada at her desk');
            // Answered — the chip stops nagging and becomes a plain edit.
            await expect(wysiwygFieldPage.altControl('Alt text')).toBeVisible();

            await wysiwygFieldPage.done();
            await contentLibraryPage.saveDraft();
            await expect.poll(() => saves.bodies).toHaveLength(1);

            expect(String(saves.bodies[0].values?.['body'])).toContain(
                'alt="Ada at her desk"'
            );
        });

        test('records a decorative image as answered, not as missing', async ({
            wysiwygFieldPage,
            contentLibraryPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await contentLibraryPage.fieldTextbox('Title').fill('Draft');

            await wysiwygFieldPage.open('Body');
            await wysiwygFieldPage.openMediaSource('Image from a URL…');
            await wysiwygFieldPage.fillMediaUrl(
                'https://example.com/divider.png'
            );
            await wysiwygFieldPage.markAltDecorative();

            // `alt=""` alone can't be told from "nobody wrote it yet", so the
            // decision is recorded — and the prompt stops asking.
            await expect(
                wysiwygFieldPage.altControl('Add alt text')
            ).toHaveCount(0);

            await wysiwygFieldPage.done();
            await contentLibraryPage.saveDraft();
            await expect.poll(() => saves.bodies).toHaveLength(1);

            const body = String(saves.bodies[0].values?.['body']);
            expect(body).toContain('alt=""');
            expect(body).toContain('data-decorative=""');
        });

        test('never saves the record from an overlay’s own form', async ({
            wysiwygFieldPage,
            contentLibraryPage
        }) => {
            // On an **existing** record, so a save would actually go out —
            // a create form's required fields would mask the bug.
            await wysiwygFieldPage.gotoArticle(WS, WYSIWYG_MEDIA_ENTRY_ID);
            await wysiwygFieldPage.open('Body');

            // These overlays portal out of the DOM but stay inside the entry
            // editor's `<form>` in the React tree, and React bubbles synthetic
            // events along *that* tree — so each of their Save/Apply/Insert
            // buttons used to submit the whole record, publishing it.
            await wysiwygFieldPage.setAltText('A hero shot, described');

            await wysiwygFieldPage.openMediaSource('Image from a URL…');
            await wysiwygFieldPage.fillMediaUrl(
                'https://example.com/second.jpg',
                'Another'
            );

            await wysiwygFieldPage.openLinkPopover();
            await wysiwygFieldPage.applyLink('https://example.com');

            // Nothing reached the write endpoint: the record is saved when the
            // author saves it, and not before.
            expect(saves.bodies).toHaveLength(0);
            await expect(contentLibraryPage.savedToast).toHaveCount(0);
        });

        test('carries the library asset’s own alt into the body', async ({
            wysiwygFieldPage,
            contentLibraryPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await contentLibraryPage.fieldTextbox('Title').fill('Draft');

            await wysiwygFieldPage.open('Body');
            await wysiwygFieldPage.openMediaSource('Media Library…');
            await wysiwygFieldPage.pickLibraryAsset('hero.png');

            // Alt written once in the library shouldn't be written again per
            // body — so this image arrives already answered.
            await expect(wysiwygFieldPage.altControl('Alt text')).toBeVisible();

            await wysiwygFieldPage.done();
            await contentLibraryPage.saveDraft();
            await expect.poll(() => saves.bodies).toHaveLength(1);

            expect(String(saves.bodies[0].values?.['body'])).toContain(
                `alt="${MEDIA_HERO_ALT}"`
            );
        });

        test('shows a stored image in the collapsed preview', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoArticle(WS, WYSIWYG_MEDIA_ENTRY_ID);
            // The preview renders the same node the editor does — it is the
            // same schema round-trip, so a picture reads as a picture.
            await expect(
                wysiwygFieldPage.preview('Body').getByRole('img')
            ).toBeVisible();
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

        test('the expanded editor has no violations', async ({
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

            await expect(
                wysiwygFieldPage.expandedHeading('Body')
            ).toBeVisible();
            await expect(wysiwygFieldPage.surface('Body')).toBeFocused();
        });
    });
});
