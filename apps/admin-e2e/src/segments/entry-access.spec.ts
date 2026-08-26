import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    RELATIONS_WORKSPACE,
    RELATIONS_SCHEMA_SEED,
    RELATIONS_DETAIL_SEED,
    RELATIONS_ENTRIES_SEED,
    mockContentSchema,
    mockContentSchemaDetail,
    mockContentEntries,
    mockContentEntryWrites,
    spyEntrySave,
    type EntrySaveSpy
} from '../support/api/content';
import { mockSegmentsApi, type SegmentsApiSpy } from '../support/api/segments';
import { expectNoA11yViolations } from '../support/a11y';

const WS = RELATIONS_WORKSPACE.id;
/** The article the relations seed already provides an editor for. */
const ENTRY = RELATIONS_ENTRIES_SEED['article'][0].id;

/**
 * The entry editor's **Access** tab — who may read this record.
 *
 * The behaviour worth a browser is the one that is invisible in a unit test:
 * the tab has **no Save button**, and what it stages must reach the entry's own
 * save body. `spyEntrySave` is the assertion target, because "did the staging
 * get there" is the only question the screen cannot answer for itself.
 */
test.describe('Entry editor — Access tab', () => {
    let saves: EntrySaveSpy;
    let segments: SegmentsApiSpy;

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
        segments = await mockSegmentsApi(page);
        saves = await spyEntrySave(page);
    });

    /** Open the article's editor on its Access tab. */
    async function openAccessTab(contentLibraryPage: {
        gotoEntry: (ws: string, type: string, id: string) => Promise<void>;
        openEditorTab: (name: string) => Promise<void>;
    }) {
        await contentLibraryPage.gotoEntry(WS, 'article', ENTRY);
        await contentLibraryPage.openEditorTab('Access');
    }

    test('lists one three-state control per audience', async ({
        contentLibraryPage,
        segmentsPage
    }) => {
        await openAccessTab(contentLibraryPage);

        // Three states, not a checkbox: "not set" is a real answer, and a
        // two-state control would leave it unreachable once a row was touched.
        await expect(segmentsPage.accessControl('Acme Corp')).toBeVisible();
        await expect(
            segmentsPage.accessOption('Acme Corp', 'Not set')
        ).toHaveAttribute('aria-checked', 'true');
    });

    test('scopes the list to the open workspace', async ({
        contentLibraryPage
    }) => {
        // An editor is offered the audiences their workspace was given, not the
        // installation's whole vocabulary.
        await openAccessTab(contentLibraryPage);

        await expect
            .poll(() => segments.listedWorkspaces.filter(Boolean))
            .toContain(WS);
    });

    test('has no Save button of its own', async ({
        page,
        contentLibraryPage
    }) => {
        // The point of the whole design: who may read a record is part of the
        // record, so it rides the editor's Save rather than a second button
        // the user has to remember their change belonged to.
        await openAccessTab(contentLibraryPage);

        await expect(
            page.getByRole('button', { name: /Save access|^Undo$/ })
        ).toHaveCount(0);
    });

    test('marks a staged change, and sends it with the entry’s save', async ({
        contentLibraryPage,
        segmentsPage
    }) => {
        await openAccessTab(contentLibraryPage);
        await segmentsPage.setAccess('Acme Corp', 'Can see');

        // The same "Changed" pill a field carries — the tab is part of the
        // record, so it says so the same way.
        await expect(segmentsPage.accessChanged).toBeVisible();
        await expect(segmentsPage.accessSummary.first()).toHaveText(
            'Restricted'
        );

        await contentLibraryPage.editorSave.click();

        // The assertion the screen cannot make: the staging reached the save
        // **body**, which is what puts it in one transaction with the record.
        await expect
            .poll(() => saves.bodies.at(-1)?.extensions)
            .toEqual({ access: { allow: ['seg-acme'], deny: [] } });
    });

    test('sends nothing about access when nothing was staged', async ({
        contentLibraryPage
    }) => {
        // What keeps the feature inert: an editor who never opens this tab
        // changes nothing and pays no request.
        await contentLibraryPage.gotoEntry(WS, 'article', ENTRY);
        await contentLibraryPage.editorSave.click();

        await expect.poll(() => saves.bodies.length).toBeGreaterThan(0);
        expect(saves.bodies.at(-1)?.extensions).toBeUndefined();
    });

    test('clears the staging when a toggle returns to what is stored', async ({
        contentLibraryPage,
        segmentsPage
    }) => {
        // Staging what is already stored would light the badge and cost a write
        // for a round trip back to where the entry started.
        await openAccessTab(contentLibraryPage);

        await segmentsPage.setAccess('Acme Corp', 'Can see');
        await expect(segmentsPage.accessChanged).toBeVisible();

        await segmentsPage.setAccess('Acme Corp', 'Not set');
        await expect(segmentsPage.accessChanged).toHaveCount(0);
    });

    test('survives a tab switch, because the staging lives above the panel', async ({
        contentLibraryPage,
        segmentsPage
    }) => {
        // Editor tabs are routes: this panel unmounts the moment the user
        // switches tab, and an unsaved decision must not go with it.
        await openAccessTab(contentLibraryPage);
        await segmentsPage.setAccess('Acme Corp', 'Cannot see');

        await contentLibraryPage.openEditorTab('General');
        await contentLibraryPage.openEditorTab('Access');

        await expect(
            segmentsPage.accessOption('Acme Corp', 'Cannot see')
        ).toHaveAttribute('aria-checked', 'true');
    });

    test('sets every matched audience at once, not just the page', async ({
        contentLibraryPage,
        segmentsPage
    }) => {
        // A control called "set every audience" that quietly set the visible
        // rows would be worse than none: the mistake is invisible until a
        // reader is turned away.
        await openAccessTab(contentLibraryPage);

        await segmentsPage.bulkAction('Can see').click();
        await contentLibraryPage.editorSave.click();

        await expect
            .poll(() => saves.bodies.at(-1)?.extensions)
            .toEqual({
                access: {
                    allow: ['seg-acme', 'seg-globex', 'seg-initech'],
                    deny: []
                }
            });
    });

    test('clears every audience with the same control', async ({
        contentLibraryPage,
        segmentsPage
    }) => {
        await openAccessTab(contentLibraryPage);

        await segmentsPage.setAccess('Acme Corp', 'Can see');
        await segmentsPage.bulkAction('Clear all').click();

        await expect(segmentsPage.accessSummary.first()).toHaveText(
            'Readable by everyone'
        );
    });

    test('is read-only for an editor without segments:manage', async ({
        page,
        contentLibraryPage,
        segmentsPage
    }) => {
        // Two gates, and they are different: `content:update` says they may
        // rewrite the article, `segments:manage` says they may publish it to a
        // new audience.
        await mockSignedIn(page, {
            permissions: [
                'workspaces:read',
                'content:read',
                'content:create',
                'content:update',
                'segments:read'
            ]
        });
        await openAccessTab(contentLibraryPage);

        await expect(
            segmentsPage.accessOption('Acme Corp', 'Can see')
        ).toBeDisabled();
        await expect(
            page.getByText(/needs the “segments:manage” permission/)
        ).toBeVisible();
        // The bulk controls go entirely, rather than sitting there dead.
        await expect(segmentsPage.bulkAction('Can see')).toHaveCount(0);
    });

    test('has no axe violations', async ({
        contentLibraryPage,
        segmentsPage,
        makeAxe
    }) => {
        await openAccessTab(contentLibraryPage);
        await expect(segmentsPage.accessControl('Acme Corp')).toBeVisible();

        await expectNoA11yViolations(makeAxe());
    });
});
