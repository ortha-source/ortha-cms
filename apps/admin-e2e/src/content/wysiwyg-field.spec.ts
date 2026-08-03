import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    WYSIWYG_WORKSPACE,
    WYSIWYG_SCHEMA_SEED,
    WYSIWYG_DETAIL_SEED,
    mockContentSchema,
    mockContentSchemaDetail,
    mockContentEntries,
    mockContentEntryWrites,
    spyEntrySave,
    type EntrySaveSpy
} from '../support/api/content';
import {
    mockMediaApi,
    mockTestImage,
    TEST_IMAGE_URL
} from '../support/api/media';
import { expectNoA11yViolations } from '../support/a11y';

const WS = WYSIWYG_WORKSPACE.id;

/** The HTML the editor last sent — the field's whole contract is this string. */
const savedBody = (saves: EntrySaveSpy): string =>
    String(saves.bodies[saves.bodies.length - 1]?.values?.['body'] ?? '');

/**
 * The entry editor's **`wysiwyg` field** — the block editor from
 * `@ortha-cms/wysiwyg-admin`.
 *
 * These cases exist because the editor's behavior is the part unit tests cannot
 * reach: a caret in a `contenteditable`, a selection spanning separate
 * editables, and a portal that takes over the work area are all things only a
 * browser has an opinion about. Wherever possible the assertion is made against
 * the **saved HTML** rather than the DOM — that string is the field's contract,
 * and asserting it catches a serializer regression a green-looking editor would
 * hide.
 */
test.describe('Entry editor — wysiwyg field', () => {
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
        saves = await spyEntrySave(page);
    });

    test('shows a preview in the form until it is opened', async ({
        wysiwygFieldPage
    }) => {
        await wysiwygFieldPage.gotoNewArticle(WS);

        await expect(wysiwygFieldPage.previewCard()).toBeVisible();
        await expect(wysiwygFieldPage.previewEmpty).toBeVisible();
        // The writing surface is not mounted until it is asked for.
        await expect(wysiwygFieldPage.editor).toBeHidden();
    });

    test('takes over the work area, hiding the other fields but not the chrome', async ({
        wysiwygFieldPage,
        page
    }) => {
        await wysiwygFieldPage.gotoNewArticle(WS);
        await expect(wysiwygFieldPage.title).toBeVisible();

        await wysiwygFieldPage.expand();

        // The form goes away for the duration…
        await expect(wysiwygFieldPage.title).toBeHidden();
        await expect(wysiwygFieldPage.region).toBeVisible();
        await expect(wysiwygFieldPage.toolbar).toBeVisible();
        // …but everything you navigate with stays.
        await expect(
            page.getByRole('navigation', { name: 'Content types' })
        ).toBeVisible();
        await expect(wysiwygFieldPage.save).toBeVisible();

        await wysiwygFieldPage.collapse();
        await expect(wysiwygFieldPage.title).toBeVisible();
    });

    test('commits what is typed and saves it as HTML', async ({
        wysiwygFieldPage
    }) => {
        await wysiwygFieldPage.gotoNewArticle(WS);
        await wysiwygFieldPage.title.fill('A record');
        await wysiwygFieldPage.expand();

        await wysiwygFieldPage.typeInto(
            wysiwygFieldPage.block('Text block'),
            'Hello there'
        );
        await wysiwygFieldPage.collapse();

        // Collapsing is not a save — the form's own Save still is.
        expect(saves.bodies).toHaveLength(0);
        // The preview reads back what was written.
        await expect(wysiwygFieldPage.wordCount('2 words')).toBeVisible();

        await wysiwygFieldPage.save.click();
        await expect.poll(() => saves.bodies.length).toBeGreaterThan(0);
        expect(savedBody(saves)).toBe('<p>Hello there</p>');
    });

    test('turns a markdown shortcut into a real block', async ({
        wysiwygFieldPage
    }) => {
        await wysiwygFieldPage.gotoNewArticle(WS);
        await wysiwygFieldPage.title.fill('A record');
        await wysiwygFieldPage.expand();

        await wysiwygFieldPage.block('Text block').click();
        await wysiwygFieldPage.type('## Findings');
        // The trigger characters are consumed, not left in the text.
        await expect(wysiwygFieldPage.block('Heading 2')).toHaveText(
            'Findings'
        );

        await wysiwygFieldPage.collapse();
        await wysiwygFieldPage.save.click();
        await expect.poll(() => saves.bodies.length).toBeGreaterThan(0);
        expect(savedBody(saves)).toBe('<h2>Findings</h2>');
    });

    test('names the preview after the document’s own first heading', async ({
        wysiwygFieldPage
    }) => {
        await wysiwygFieldPage.gotoNewArticle(WS);
        await wysiwygFieldPage.expand();
        await wysiwygFieldPage.block('Text block').click();
        await wysiwygFieldPage.type('# Post-mortem');
        await wysiwygFieldPage.collapse();

        // A post-mortem is known by its heading, not by the field it lives in.
        await expect(wysiwygFieldPage.previewCard('Post-mortem')).toBeVisible();
    });

    test('inserts a block from the slash menu', async ({
        wysiwygFieldPage
    }) => {
        await wysiwygFieldPage.gotoNewArticle(WS);
        await wysiwygFieldPage.title.fill('A record');
        await wysiwygFieldPage.expand();

        await wysiwygFieldPage.insertViaSlash('quote', 'Quote');
        await wysiwygFieldPage.type('Said so');

        await wysiwygFieldPage.collapse();
        await wysiwygFieldPage.save.click();
        await expect.poll(() => saves.bodies.length).toBeGreaterThan(0);
        // A blockquote wraps its line in a `<p>` — that is the semantic shape
        // the serializer emits, not editor scaffolding.
        expect(savedBody(saves)).toBe(
            '<blockquote><p>Said so</p></blockquote>'
        );
    });

    test('Escape closes the slash menu before it closes the editor', async ({
        wysiwygFieldPage
    }) => {
        await wysiwygFieldPage.gotoNewArticle(WS);
        await wysiwygFieldPage.expand();

        await wysiwygFieldPage.runSlash(
            wysiwygFieldPage.block('Text block'),
            'quote'
        );
        await wysiwygFieldPage.press('Escape');

        await expect(wysiwygFieldPage.slashMenu).toBeHidden();
        // The editor is still open — the menu claimed that Escape.
        await expect(wysiwygFieldPage.editor).toBeVisible();

        await wysiwygFieldPage.press('Escape');
        await expect(wysiwygFieldPage.editor).toBeHidden();
    });

    test.describe('multi-block selection', () => {
        test('drag-selects a run and marks every block in it', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.title.fill('A record');
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.writeParagraphs('Alpha', 'Beta', 'Gamma');

            await wysiwygFieldPage.dragSelect(0, 2);
            await expect(wysiwygFieldPage.selectedBlocks).toHaveCount(3);

            // `execCommand` cannot reach across separate editables, so a block
            // selection marks each block's whole content instead.
            await wysiwygFieldPage.toolbarButton('Bold').click();
            await wysiwygFieldPage.collapse();
            await wysiwygFieldPage.save.click();
            await expect.poll(() => saves.bodies.length).toBeGreaterThan(0);
            expect(savedBody(saves)).toBe(
                '<p><strong>Alpha</strong></p><p><strong>Beta</strong></p><p><strong>Gamma</strong></p>'
            );
        });

        test('deletes the whole selection with one Backspace', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.title.fill('A record');
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.writeParagraphs('Alpha', 'Beta', 'Gamma');

            await wysiwygFieldPage.dragSelect(0, 1);
            await wysiwygFieldPage.press('Backspace');

            await expect(wysiwygFieldPage.selectedBlocks).toHaveCount(0);
            await wysiwygFieldPage.collapse();
            await wysiwygFieldPage.save.click();
            await expect.poll(() => saves.bodies.length).toBeGreaterThan(0);
            expect(savedBody(saves)).toBe('<p>Gamma</p>');
        });

        test('⌘A selects every block, Escape drops the selection', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.writeParagraphs('Alpha', 'Beta', 'Gamma');

            // The browser's own select-all stops at one editable, which reads
            // as broken; the editor promotes it to the whole document.
            await wysiwygFieldPage.selectAllBlocks();
            await expect(wysiwygFieldPage.selectedBlocks).toHaveCount(3);

            await wysiwygFieldPage.press('Escape');
            await expect(wysiwygFieldPage.selectedBlocks).toHaveCount(0);
            // Escape cleared the selection rather than closing the editor.
            await expect(wysiwygFieldPage.editor).toBeVisible();
        });

        test('turns a whole selection into another block type', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.title.fill('A record');
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.writeParagraphs('Alpha', 'Beta', 'Gamma');

            await wysiwygFieldPage.dragSelect(0, 2);
            await wysiwygFieldPage.turnInto.click();
            await wysiwygFieldPage.chooseMenuItem('Bulleted list');

            await wysiwygFieldPage.collapse();
            await wysiwygFieldPage.save.click();
            await expect.poll(() => saves.bodies.length).toBeGreaterThan(0);
            // Three blocks, one `<ul>` — the wrapper is a serialization
            // concern, not a fourth block.
            expect(savedBody(saves)).toBe(
                '<ul><li>Alpha</li><li>Beta</li><li>Gamma</li></ul>'
            );
        });
    });

    test.describe('alignment, colour and size', () => {
        test('aligns a block, and clears it back to nothing', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.title.fill('A record');
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.typeInto(
                wysiwygFieldPage.block('Text block'),
                'Centred'
            );

            await wysiwygFieldPage.alignButton('Align centre').click();
            await wysiwygFieldPage.collapse();
            await wysiwygFieldPage.save.click();
            await expect.poll(() => saves.bodies.length).toBeGreaterThan(0);
            expect(savedBody(saves)).toBe('<p data-align="center">Centred</p>');

            // Left is the absence of an alignment, so going back leaves the
            // paragraph byte-identical to one nobody ever aligned.
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.block('Text block').click();
            await wysiwygFieldPage.alignButton('Align left').click();
            await wysiwygFieldPage.collapse();
            await wysiwygFieldPage.save.click();
            await expect.poll(() => saves.bodies.length).toBeGreaterThan(1);
            expect(savedBody(saves)).toBe('<p>Centred</p>');
        });

        test('aligns every block in a selection at once', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.title.fill('A record');
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.writeParagraphs('One', 'Two', 'Three');

            await wysiwygFieldPage.dragSelect(0, 2);
            await wysiwygFieldPage.alignButton('Align right').click();

            await wysiwygFieldPage.collapse();
            await wysiwygFieldPage.save.click();
            await expect.poll(() => saves.bodies.length).toBeGreaterThan(0);
            expect(savedBody(saves)).toBe(
                '<p data-align="right">One</p><p data-align="right">Two</p>' +
                    '<p data-align="right">Three</p>'
            );
        });

        test('aligns from the keyboard', async ({ wysiwygFieldPage }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.title.fill('A record');
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.typeInto(
                wysiwygFieldPage.block('Text block'),
                'Keyed'
            );

            await wysiwygFieldPage.press('ControlOrMeta+Shift+e');
            await wysiwygFieldPage.collapse();
            await wysiwygFieldPage.save.click();
            await expect.poll(() => saves.bodies.length).toBeGreaterThan(0);
            expect(savedBody(saves)).toBe('<p data-align="center">Keyed</p>');
        });

        test('colours a run of text, and takes the colour back off', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.title.fill('A record');
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.typeInto(
                wysiwygFieldPage.block('Text block'),
                'Coloured'
            );

            await wysiwygFieldPage.selectLine('Text block');
            await wysiwygFieldPage.pickColor('text', 'Blue');
            await wysiwygFieldPage.collapse();
            await wysiwygFieldPage.save.click();
            await expect.poll(() => saves.bodies.length).toBeGreaterThan(0);
            // A palette name, never a hex — the delivery surface maps it.
            expect(savedBody(saves)).toBe(
                '<p><span data-color="blue">Coloured</span></p>'
            );

            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.selectLine('Text block');
            await wysiwygFieldPage.pickColor('text', 'Default');
            await wysiwygFieldPage.collapse();
            await wysiwygFieldPage.save.click();
            await expect.poll(() => saves.bodies.length).toBeGreaterThan(1);
            // Removing a colour removes the markup, not just the attribute.
            expect(savedBody(saves)).toBe('<p>Coloured</p>');
        });

        test('highlights a run as a <mark>', async ({ wysiwygFieldPage }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.title.fill('A record');
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.typeInto(
                wysiwygFieldPage.block('Text block'),
                'Marked'
            );

            await wysiwygFieldPage.selectLine('Text block');
            await wysiwygFieldPage.pickColor('highlight', 'Yellow');
            await wysiwygFieldPage.collapse();
            await wysiwygFieldPage.save.click();
            await expect.poll(() => saves.bodies.length).toBeGreaterThan(0);
            // `<mark>` already means "marked for reference", so the document
            // keeps that meaning even where the palette doesn't reach.
            expect(savedBody(saves)).toBe(
                '<p><mark data-highlight="yellow">Marked</mark></p>'
            );
        });

        test('inline code survives a save with no typing after it', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.title.fill('A record');
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.typeInto(
                wysiwygFieldPage.block('Text block'),
                'code'
            );

            // A regression guard: the marks that can't go through
            // `execCommand` edit the DOM directly and fire no `input` event, so
            // they used to show in the editor and vanish on save.
            await wysiwygFieldPage.selectLine('Text block');
            await wysiwygFieldPage.toolbarButton('Inline code').click();
            await wysiwygFieldPage.collapse();
            await wysiwygFieldPage.save.click();
            await expect.poll(() => saves.bodies.length).toBeGreaterThan(0);
            expect(savedBody(saves)).toBe('<p><code>code</code></p>');
        });

        test('centres the picture itself, not just its caption', async ({
            wysiwygFieldPage,
            page
        }) => {
            await mockTestImage(page);
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.insertViaSlash('image', 'Image');
            await wysiwygFieldPage.imageUrl.fill(TEST_IMAGE_URL);
            await wysiwygFieldPage.addImage.click();
            // Wait for it to actually load — an image that 404s has no
            // intrinsic width and stretches, which would pass a naive check.
            await expect
                .poll(() =>
                    wysiwygFieldPage.editor
                        .locator('figure img')
                        .first()
                        .evaluate(
                            (img) => (img as HTMLImageElement).naturalWidth
                        )
                )
                .toBeGreaterThan(0);

            await wysiwygFieldPage.alignButton('Align centre').click();

            // The markup says `data-align="center"` either way, so this has to
            // read what the browser laid out: the reset makes `<img>` a block,
            // and a block box ignores `text-align` — only auto margins move it.
            // Measured as a gap rather than as a margin, because *which* box
            // carries the margin is an implementation detail and has changed.
            const [left, right] = await wysiwygFieldPage.gapsWithin(
                'figure img',
                'figure'
            );
            expect(left).toBeGreaterThan(0);
            expect(Math.abs(left - right)).toBeLessThan(2);
        });

        test('links through the toolbar’s own popover, and unlinks again', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.title.fill('A record');
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.typeInto(
                wysiwygFieldPage.block('Text block'),
                'Linked'
            );

            await wysiwygFieldPage.selectLine('Text block');
            await wysiwygFieldPage.applyLink('https://example.com');
            await wysiwygFieldPage.collapse();
            await wysiwygFieldPage.save.click();
            await expect.poll(() => saves.bodies.length).toBeGreaterThan(0);
            expect(savedBody(saves)).toBe(
                '<p><a href="https://example.com">Linked</a></p>'
            );

            // Remove has to survive the popover opening: focus moves into it,
            // the selection goes, and a live read would report no link at all.
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.selectLine('Text block');
            await wysiwygFieldPage.removeLink();
            await wysiwygFieldPage.collapse();
            await wysiwygFieldPage.save.click();
            await expect.poll(() => saves.bodies.length).toBeGreaterThan(1);
            expect(savedBody(saves)).toBe('<p>Linked</p>');
        });

        test('takes a custom colour, stored as hex', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.title.fill('A record');
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.typeInto(
                wysiwygFieldPage.block('Text block'),
                'Brand'
            );

            await wysiwygFieldPage.selectLine('Text block');
            await wysiwygFieldPage.pickCustomColor('text', '#ff0055');
            await wysiwygFieldPage.collapse();
            await wysiwygFieldPage.save.click();
            await expect.poll(() => saves.bodies.length).toBeGreaterThan(0);
            // A browser rewrites the inline colour to `rgb(...)`; the sanitizer
            // canonicalizes it back, so what is stored is always hex.
            expect(savedBody(saves)).toBe(
                '<p><span style="color: #ff0055">Brand</span></p>'
            );
        });

        test('names every toolbar control on hover', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.block('Text block').click();

            // The icons are the entire label; a row of them is unreadable
            // until you can point at one and be told what it does.
            expect(await wysiwygFieldPage.tooltipFor('Bold')).toContain('Bold');
        });

        test('sizes an image and centres it', async ({ wysiwygFieldPage }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.title.fill('A record');
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.insertViaSlash('image', 'Image');
            await wysiwygFieldPage.imageUrl.fill('https://cdn.test/a.png');
            await wysiwygFieldPage.addImage.click();

            await wysiwygFieldPage.imageWidth('Medium').click();
            await wysiwygFieldPage.alignButton('Align centre').click();

            await wysiwygFieldPage.collapse();
            await wysiwygFieldPage.save.click();
            await expect.poll(() => saves.bodies.length).toBeGreaterThan(0);
            // A preset, not a pixel width — the stored HTML renders on a
            // surface whose measure this editor never sees.
            expect(savedBody(saves)).toContain(
                '<figure data-size="medium" data-align="center">'
            );
        });

        test('resizes an image by dragging its grip, replacing the preset', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.title.fill('A record');
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.insertViaSlash('image', 'Image');
            await wysiwygFieldPage.imageUrl.fill('https://cdn.test/a.png');
            await wysiwygFieldPage.addImage.click();
            await wysiwygFieldPage.imageWidth('Medium').click();

            const before = await wysiwygFieldPage.widthOf('figure');
            await wysiwygFieldPage.dragBy(
                wysiwygFieldPage.imageResizer('right'),
                -120
            );
            expect(await wysiwygFieldPage.widthOf('figure')).toBeLessThan(
                before - 60
            );

            await wysiwygFieldPage.collapse();
            await wysiwygFieldPage.save.click();
            await expect.poll(() => saves.bodies.length).toBeGreaterThan(0);
            // The dragged width replaces the preset rather than joining it —
            // two statements of the same thing is two things to disagree.
            const saved = savedBody(saves);
            expect(saved).toMatch(/<figure style="width: \d+(\.\d+)?%">/);
            expect(saved).not.toContain('data-size');
        });
    });

    test.describe('tables', () => {
        test('inserts a table and types across it with Tab', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.insertTable();

            await wysiwygFieldPage.cell(1, 1).click();
            await wysiwygFieldPage.type('Name');
            // Tab moves along the row rather than indenting the block.
            await wysiwygFieldPage.press('Tab');
            await wysiwygFieldPage.type('Role');

            expect((await wysiwygFieldPage.grid())[0]).toEqual([
                'Name',
                'Role',
                ''
            ]);
        });

        test('Enter inside a cell breaks the line instead of splitting the block', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.title.fill('A record');
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.insertTable();

            await wysiwygFieldPage.cell(2, 1).click();
            await wysiwygFieldPage.type('one');
            await wysiwygFieldPage.press('Enter');
            await wysiwygFieldPage.type('two');

            // A paragraph among the cells of a row is not a table — and the
            // caret must land *after* the break, not before it.
            await wysiwygFieldPage.collapse();
            await wysiwygFieldPage.save.click();
            await expect.poll(() => saves.bodies.length).toBeGreaterThan(0);
            expect(savedBody(saves)).toContain('<td>one<br>two</td>');
        });

        test('adds a column and removes a row from the handles', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.insertTable();
            expect((await wysiwygFieldPage.grid())[0]).toHaveLength(3);

            await wysiwygFieldPage.columnMenu(1).click();
            await wysiwygFieldPage.chooseMenuItem('Insert column right');
            expect((await wysiwygFieldPage.grid())[0]).toHaveLength(4);

            const rowsBefore = (await wysiwygFieldPage.grid()).length;
            await wysiwygFieldPage.rowMenu(2).click();
            await wysiwygFieldPage.chooseMenuItem('Delete row');
            expect(await wysiwygFieldPage.grid()).toHaveLength(rowsBefore - 1);
        });

        test('the header row is a thead, and the toggle takes it away', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.title.fill('A record');
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.insertTable();
            await wysiwygFieldPage.cell(1, 1).click();
            await wysiwygFieldPage.type('Name');

            await wysiwygFieldPage.collapse();
            await wysiwygFieldPage.save.click();
            await expect.poll(() => saves.bodies.length).toBeGreaterThan(0);
            expect(savedBody(saves)).toContain('<thead><tr><th>Name</th>');

            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.headerRowToggle.click();
            await wysiwygFieldPage.collapse();
            await wysiwygFieldPage.save.click();
            await expect.poll(() => saves.bodies.length).toBeGreaterThan(1);
            // `<thead>` is derived from the cells, never stored — so dropping
            // header-ness drops the wrapper with it.
            expect(savedBody(saves)).not.toContain('<thead>');
            expect(savedBody(saves)).toContain('<td>Name</td>');
        });

        test('centres the table without centring what is in it', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.title.fill('A record');
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.insertTable();
            await wysiwygFieldPage.cell(1, 1).click();
            await wysiwygFieldPage.type('Name');

            await wysiwygFieldPage.tableAlign('Align centre').click();
            // Where the box sits and where the words sit are two choices; the
            // table's own alignment must not inherit down into the cells.
            expect(await wysiwygFieldPage.textAlignOf('th')).toBe('left');

            await wysiwygFieldPage.collapse();
            await wysiwygFieldPage.save.click();
            await expect.poll(() => saves.bodies.length).toBeGreaterThan(0);
            expect(savedBody(saves)).toContain('<table data-align="center">');
        });

        test('aligns a column, and stands it on the bottom of its cells', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.title.fill('A record');
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.insertTable();
            await wysiwygFieldPage.cell(1, 1).click();
            await wysiwygFieldPage.type('Name');

            await wysiwygFieldPage.columnMenu(1).click();
            await wysiwygFieldPage.chooseSubMenuItem(
                'Align content',
                'Align centre'
            );
            expect(await wysiwygFieldPage.textAlignOf('th')).toBe('center');

            await wysiwygFieldPage.columnMenu(1).click();
            await wysiwygFieldPage.chooseSubMenuItem(
                'Vertical align',
                'Bottom'
            );

            await wysiwygFieldPage.collapse();
            await wysiwygFieldPage.save.click();
            await expect.poll(() => saves.bodies.length).toBeGreaterThan(0);
            // Every cell of the column, not just the one the menu was opened
            // over — a column is not a block, so the cells are all there is.
            expect(savedBody(saves)).toContain(
                '<th data-valign="bottom" data-align="center">Name</th>'
            );
            expect(savedBody(saves)).toContain(
                '<td data-valign="bottom" data-align="center"></td>'
            );
        });

        test('a column grip never reaches into the column beside it', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.insertTable();

            // The grip used to straddle the border, so half of it lay over the
            // next column — on top — and swallowed every press near that
            // column's left edge: its handle, its menu, and the caret.
            const cell = await wysiwygFieldPage.cell(1, 2).boundingBox();
            if (!cell) throw new Error('the cell is not laid out');
            expect(
                await wysiwygFieldPage.topmostAt(
                    cell.x + 2,
                    cell.y + cell.height / 2
                )
            ).not.toContain('Resize column');

            // Clicking there types into the column you pointed at, and the
            // neighbour's handle still opens its own menu.
            await wysiwygFieldPage.clickAt(
                cell.x + 2,
                cell.y + cell.height / 2
            );
            await wysiwygFieldPage.type('here');
            expect((await wysiwygFieldPage.grid())[0][1]).toBe('here');

            await wysiwygFieldPage.columnMenu(2).click();
            await expect(
                wysiwygFieldPage.menuItem('Insert column left')
            ).toBeVisible();
        });

        test('resizes a column by dragging its grip', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.title.fill('A record');
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.insertTable();
            await wysiwygFieldPage.cell(1, 1).click();
            await wysiwygFieldPage.type('Name');

            const before = await wysiwygFieldPage.widthOf('th');
            await wysiwygFieldPage.dragBy(
                wysiwygFieldPage.columnResizer(1),
                160
            );
            // A width is a *computed* outcome — the model holding 40 proves
            // nothing about whether the column actually moved.
            expect(await wysiwygFieldPage.widthOf('th')).toBeGreaterThan(
                before + 100
            );

            await wysiwygFieldPage.collapse();
            await wysiwygFieldPage.save.click();
            await expect.poll(() => saves.bodies.length).toBeGreaterThan(0);
            const saved = savedBody(saves);
            // Percentages of the table, and the table pinned to the measure —
            // otherwise the percentage is of a number the author cannot see.
            expect(saved).toContain('<table style="width: 100%">');
            expect(saved).toMatch(/<th style="width: \d+(\.\d+)?%">Name<\/th>/);
        });
    });

    test.describe('the image block', () => {
        test.beforeEach(async ({ page }) => {
            await mockMediaApi(page);
        });

        test('fills an image from the media library', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.title.fill('A record');
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.insertViaSlash('image', 'Image');

            // The library trigger appears only because a host registered a
            // picker; a pasted URL is the fallback either way.
            await wysiwygFieldPage.chooseFromLibrary.click();
            await expect(wysiwygFieldPage.pickerDialog).toBeVisible();
            await wysiwygFieldPage.pickAsset('hero.png');

            await expect(wysiwygFieldPage.pickerDialog).toBeHidden();
            await expect(wysiwygFieldPage.replaceFromLibrary).toBeVisible();

            await wysiwygFieldPage.collapse();
            await wysiwygFieldPage.save.click();
            await expect.poll(() => saves.bodies.length).toBeGreaterThan(0);
            // The URL is stored, not an asset id — a wysiwyg value is HTML any
            // consumer can render with nothing to resolve.
            expect(savedBody(saves)).toContain('<figure><img src="');
        });

        test('keeps alt text the author wrote over an asset that carries none', async ({
            wysiwygFieldPage
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.insertViaSlash('image', 'Image');
            await wysiwygFieldPage.chooseFromLibrary.click();
            await wysiwygFieldPage.pickAsset('hero.png');

            // Always visible, never behind a menu: an image published with no
            // alt text is a defect, and this is the moment to fix it.
            await expect(wysiwygFieldPage.altText).toBeVisible();
            await wysiwygFieldPage.altText.fill('My own words');
            await wysiwygFieldPage.replaceFromLibrary.click();
            await wysiwygFieldPage.pickAsset('hero.png');

            await expect(wysiwygFieldPage.altText).toHaveValue('My own words');
        });
    });

    test('rejects a document whose text is over the field’s limit', async ({
        wysiwygFieldPage
    }) => {
        await wysiwygFieldPage.gotoNewArticle(WS);
        await wysiwygFieldPage.title.fill('A record');
        await wysiwygFieldPage.expand();
        await wysiwygFieldPage.block('Text block').click();
        // Formatting must not count against the budget — the ceiling is 40
        // characters of *text*, and this is 44 of them under a tag.
        await wysiwygFieldPage.type('a'.repeat(44));
        await wysiwygFieldPage.selectAllBlocks();
        await wysiwygFieldPage.toolbarButton('Bold').click();
        await wysiwygFieldPage.collapse();

        await wysiwygFieldPage.save.click();
        await expect(wysiwygFieldPage.fieldError(/at most 40/)).toBeVisible();
        // Nothing was sent — client validation ran first.
        expect(saves.bodies).toHaveLength(0);
    });

    test('is reachable and operable from the keyboard alone', async ({
        wysiwygFieldPage
    }) => {
        await wysiwygFieldPage.gotoNewArticle(WS);

        // The preview is a real button, so it opens on Enter.
        await wysiwygFieldPage.previewCard().focus();
        await wysiwygFieldPage.press('Enter');
        await expect(wysiwygFieldPage.editor).toBeVisible();

        await wysiwygFieldPage.block('Text block').click();
        await wysiwygFieldPage.type('Typed');
        await wysiwygFieldPage.press('ControlOrMeta+a');
        await wysiwygFieldPage.press('ControlOrMeta+b');
        await expect(wysiwygFieldPage.editor.locator('strong')).toHaveText(
            'Typed'
        );

        await wysiwygFieldPage.press('ControlOrMeta+z');
        await expect(wysiwygFieldPage.editor.locator('strong')).toHaveCount(0);
    });

    test.describe('accessibility (axe, WCAG 2.1 A/AA)', () => {
        test('the expanded editor', async ({ wysiwygFieldPage, makeAxe }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.expand();
            await expectNoA11yViolations(makeAxe());
        });

        test('with the slash menu open', async ({
            wysiwygFieldPage,
            makeAxe
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.runSlash(
                wysiwygFieldPage.block('Text block'),
                ''
            );
            await expectNoA11yViolations(makeAxe());
        });

        test('with a table in the document', async ({
            wysiwygFieldPage,
            makeAxe
        }) => {
            await wysiwygFieldPage.gotoNewArticle(WS);
            await wysiwygFieldPage.expand();
            await wysiwygFieldPage.insertTable();
            await expectNoA11yViolations(makeAxe());
        });
    });
});
