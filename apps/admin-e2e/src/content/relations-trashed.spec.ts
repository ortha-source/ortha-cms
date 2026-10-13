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
    mockEntryRelations,
    mockRelationFieldLinks
} from '../support/api/content';
import { expectNoA11yViolations } from '../support/a11y';

const WS = RELATIONS_WORKSPACE.id;
const ARTICLE = 'article-trash';
/** The raw id of a link whose target cannot be resolved at all. */
const GONE_ID = '7d3f0c1e-0000-4000-8000-00000000dead';

/**
 * Links whose target is in the **trash** name the record and mark it — the
 * editor used to print the target's raw id — and a link nothing resolves reads
 * "Unavailable record".
 */
test.describe('Relations into the trash [content:I-57]', () => {
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
        await mockContentEntryRead(page, {
            records: {
                [`article/${ARTICLE}`]: {
                    text: 'Scaling Postgres',
                    author: 'author-ada',
                    seo: null
                }
            }
        });
        const tags = [
            { id: 'tag-eng', title: 'engineering', trashed: true },
            { id: GONE_ID, title: GONE_ID, missing: true }
        ];
        await mockEntryRelations(page, {
            relations: {
                [`article/${ARTICLE}`]: {
                    author: [
                        {
                            id: 'author-ada',
                            title: 'Ada Lovelace',
                            trashed: true
                        }
                    ],
                    tags
                }
            }
        });
        await mockRelationFieldLinks(page, { links: { 'article/tags': tags } });
    });

    test('names a trashed record, marks it, and explains the mark', async ({
        relationsEditorPage,
        contentLibraryPage
    }) => {
        await relationsEditorPage.gotoEntryRelations(WS, 'article', ARTICLE);

        await expect(relationsEditorPage.text('Ada Lovelace')).toBeVisible();
        await expect(relationsEditorPage.text('engineering')).toBeVisible();
        await expect(relationsEditorPage.trashedBadges).toHaveCount(2);

        // The mark explains itself on focus, not only on hover.
        await relationsEditorPage.trashedBadges.first().focus();
        await expect(contentLibraryPage.tooltip).toContainText(
            'Restore the record to bring the link back'
        );
    });

    test('reads an unresolvable link as unavailable, never its id', async ({
        relationsEditorPage
    }) => {
        await relationsEditorPage.gotoEntryRelations(WS, 'article', ARTICLE);
        await expect(relationsEditorPage.unavailableRecords).toHaveCount(1);
        await expect(relationsEditorPage.text(GONE_ID)).toHaveCount(0);
    });

    test('has no a11y violations with trashed links on screen', async ({
        relationsEditorPage,
        makeAxe
    }) => {
        await relationsEditorPage.gotoEntryRelations(WS, 'article', ARTICLE);
        await expect(relationsEditorPage.trashedBadges).toHaveCount(2);
        await expectNoA11yViolations(makeAxe());
    });
});
