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
    mockContentEntryRead,
    mockEntryRelations,
    mockRelationFieldLinks,
    spyEntrySave
} from '../support/api/content';
import { I18N_WORKSPACE, mockI18n, spyEntryWrites } from '../support/api/i18n';
import { UNPROTECTED, mockEntryReview } from '../support/api/protection';

/**
 * The editor's Publish as the review rules need it to behave, on the paths that
 * need a catalogue of their own: a record whose only change is a staged link,
 * and a localized record whose save stops to warn about shared fields.
 *
 * `protection-review.spec.ts` holds the rest. Both files pin the invariants at
 * the end of `docs/design/protection.md`: an unchanged record publishes without
 * a save (I-19), and anything that is not unchanged is saved first — including
 * by a bypass, which has to survive whatever stands between the click and the
 * publish (I-20).
 */
test.describe('Publish, with a staged link and nothing else', () => {
    /** The article the relations seed already provides an editor for. */
    const ENTRY = RELATIONS_ENTRIES_SEED['article'][0].id;

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
        // Both relation reads: unmocked, the per-field page arrives without
        // `items` and the editor dies in its error boundary (see
        // `segments/entry-access.spec.ts`).
        await mockEntryRelations(page);
        await mockRelationFieldLinks(page);
        // The record itself, so its values pass the publish gate.
        await mockContentEntryRead(page, {
            records: {
                [`article/${ENTRY}`]: {
                    text: 'Getting started',
                    author: null,
                    seo: null
                }
            }
        });
        await mockEntryReview(page, UNPROTECTED);
    });

    /**
     * A link lives in a staging area, not in the form's values, so "the form is
     * clean" is not "nothing to save". Skipping the save here would publish the
     * record without the link the person just added.
     */
    test('saves the staged link before publishing [protection:I-19]', async ({
        page,
        contentLibraryPage,
        relationsEditorPage
    }) => {
        const saves = await spyEntrySave(page);
        const order: string[] = [];
        page.on('request', (request) => {
            const path = new URL(request.url()).pathname;
            if (request.method() === 'PATCH') order.push('save');
            if (path.endsWith(`/${ENTRY}/publish`)) order.push('publish');
        });
        await contentLibraryPage.gotoEntry(
            RELATIONS_WORKSPACE.id,
            'article',
            ENTRY
        );
        await relationsEditorPage.openRelationsTab();
        await relationsEditorPage.addRelatedButton.click();
        await relationsEditorPage.candidate('engineering').click();
        await relationsEditorPage.addSelectedButton.click();

        await page.getByRole('button', { name: /^publish$/i }).click();

        await expect.poll(() => order).toEqual(['save', 'publish']);
        expect(saves.bodies[0]?.relations?.tags?.link).toEqual(['tag-01']);
    });
});

test.describe('A bypass on a localized record with shared-field edits', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [I18N_WORKSPACE]);
        await mockI18n(page);
        await mockEntryReview(page, {
            required: 1,
            given: 1,
            blocked: false,
            afterSave: { given: 0, blocked: true, bypassable: true }
        });
    });

    /**
     * Two dialogs stand between the click and the publish here: the bypass
     * confirmation, then the warning that a shared field changes every locale.
     * The bypass is confirmed in the first and has to reach the publish after
     * the second — dropping it there would send a publish the guard refuses.
     */
    test('carries the bypass through the shared-fields warning [protection:I-20]', async ({
        page,
        contentLibraryPage
    }) => {
        const writes = spyEntryWrites(page);
        await contentLibraryPage.goto(I18N_WORKSPACE.id);
        await contentLibraryPage.typeLink('Localized posts').click();
        await contentLibraryPage.recordLink('Winter boots').click();
        await expect(contentLibraryPage.editorSave).toBeVisible();

        // `category` is shared: one value for every locale of the record.
        await contentLibraryPage.fieldTrigger('category').click();
        await page.getByRole('option', { name: 'news' }).click();

        await page.getByRole('button', { name: /^publish$/i }).click();
        const bypass = page.getByRole('dialog');
        await bypass.getByRole('button', { name: /publish anyway/i }).click();

        await expect(
            page.getByText('This also changes the other locales')
        ).toBeVisible();
        await page.getByRole('button', { name: 'Save anyway' }).click();

        await expect
            .poll(() => writes.map((write) => write.method))
            .toEqual(['PATCH', 'POST']);
        expect(writes[1].path).toMatch(/\/publish$/);
        expect(writes[1].body).toEqual({ bypass: true });
    });
});
