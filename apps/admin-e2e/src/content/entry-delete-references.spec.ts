import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    RELATIONS_DETAIL_SEED,
    RELATIONS_ENTRIES_SEED,
    RELATIONS_SCHEMA_SEED,
    RELATIONS_WORKSPACE,
    mockContentEntries,
    mockContentEntryRead,
    mockContentEntryWrites,
    mockContentSchema,
    mockContentSchemaDetail,
    mockEntryMedia,
    mockEntryReferences,
    mockEntryRelations,
    mockRelationFieldLinks
} from '../support/api/content';

const WS = RELATIONS_WORKSPACE.id;
const ARTICLE = 'article-linked';

/**
 * Deleting a record says what links to it — how many records, how many of them
 * live, and, for a permanent delete, what each foreign key does to them. A
 * delete used to go through with no word about what pointed at the record.
 */
test.describe('Delete confirmation lists the references [content:I-58]', () => {
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
        await mockEntryMedia(page);
        await mockEntryRelations(page);
        await mockRelationFieldLinks(page);
        await mockContentEntryRead(page, {
            records: {
                [`article/${ARTICLE}`]: {
                    text: 'Scaling Postgres',
                    author: null,
                    seo: null
                }
            }
        });
    });

    test('names the referrers and what a permanent delete does to them', async ({
        page,
        contentLibraryPage
    }) => {
        await mockEntryReferences(page, [
            {
                typeName: 'comment',
                typeLabel: 'Comments',
                field: 'article',
                fieldLabel: 'Article',
                count: 2,
                live: 2,
                onPurge: 'delete'
            },
            {
                typeName: 'page',
                typeLabel: 'Pages',
                field: 'featured',
                fieldLabel: 'Featured',
                count: 1,
                live: 0,
                onPurge: 'unlink'
            }
        ]);
        await contentLibraryPage.gotoEntry(WS, 'article', ARTICLE);
        await expect(contentLibraryPage.editorSave).toBeVisible();
        await contentLibraryPage.openEditorMenu();
        await contentLibraryPage.editorMenuItem('Delete').click();

        const dialog = contentLibraryPage.deleteDialog;
        await expect(dialog).toContainText('3 records link to this entry');
        await expect(dialog).toContainText('2 of them live');
        // `article` keeps no trash, so this delete is permanent: the cascade
        // the comments' required relation causes is spelled out.
        await expect(dialog).toContainText(
            'also deletes 2 records that require it: Comments · Article'
        );
        await expect(dialog).toContainText('1 record loses its link');
    });
});
