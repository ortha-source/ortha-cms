import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    RELATIONS_SCHEMA_SEED,
    RELATIONS_DETAIL_SEED,
    RELATIONS_ENTRIES_SEED,
    mockContentSchema,
    mockContentSchemaDetail,
    mockContentEntries,
    mockContentEntryWrites,
    mockEntryRelations
} from '../support/api/content';
import {
    BRAND_HUB_WORKSPACE,
    PER_SOURCE_SCHEMA_SEED,
    PER_SOURCE_WORKSPACE,
    SHARED_TAGS,
    mockContentSchemaByWorkspace,
    mockForeignTag,
    mockSharedTagEntries,
    spyContentWrites,
    type SourceScopeSpy
} from '../support/api/sharing';
import { expectNoA11yViolations } from '../support/a11y';

const WS = PER_SOURCE_WORKSPACE.id;
const SOURCE = BRAND_HUB_WORKSPACE.id;

/**
 * **Per-source content grants** in the Content Library
 * (`@orthacms/content-admin`): a workspace granted Authors both as its own and
 * from the Brand hub, and Tags **only** from the Brand hub. The sidebar lists
 * each source's types under "From {workspace}", a shared entry opens that
 * source's records read-only, a type reached only from shared workspaces
 * offers no way to create one, and the relation picker's Source select offers
 * exactly the sources each target has. Mocked against the frozen contract
 * (`access`, `sharedContent`, `?source=shared`).
 */
test.describe('Per-source shared content grants', () => {
    let tagScopes: SourceScopeSpy;

    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [PER_SOURCE_WORKSPACE, BRAND_HUB_WORKSPACE]);
        await mockContentSchema(page, { types: RELATIONS_SCHEMA_SEED });
        await mockContentSchemaByWorkspace(page, {
            [WS]: PER_SOURCE_SCHEMA_SEED
        });
        await mockContentSchemaDetail(page, { details: RELATIONS_DETAIL_SEED });
        await mockContentEntries(page, {
            details: RELATIONS_DETAIL_SEED,
            entries: RELATIONS_ENTRIES_SEED
        });
        await mockContentEntryWrites(page, { details: RELATIONS_DETAIL_SEED });
        await mockEntryRelations(page);
        tagScopes = await mockSharedTagEntries(page);
    });

    test.describe('sidebar', () => {
        test('lists own types under Workspace Content and each source under "From {workspace}"', async ({
            contentLibraryPage
        }) => {
            await contentLibraryPage.goto(WS);

            await expect(
                contentLibraryPage.sharedGroup('Brand hub')
            ).toBeVisible();
            await expect(
                contentLibraryPage.sharedTypeLink('Brand hub', 'Tags')
            ).toBeVisible();
            await expect(
                contentLibraryPage.sharedTypeLink('Brand hub', 'Authors')
            ).toBeVisible();
            // Authors is granted both ways, so it is listed twice; Tags only
            // from the Brand hub, so its one row is the shared one.
            await expect(contentLibraryPage.typeLink('Authors')).toHaveCount(2);
            await expect(contentLibraryPage.typeLink('Tags')).toHaveCount(1);
        });

        test('a shared entry opens that source’s records, read-only', async ({
            page,
            contentLibraryPage
        }) => {
            await mockForeignTag(page);
            const writes = spyContentWrites(page);
            await contentLibraryPage.goto(WS);

            await contentLibraryPage
                .sharedTypeLink('Brand hub', 'Tags')
                .click();

            await expect(page).toHaveURL(
                new RegExp(`/workspaces/${WS}/content/tag/shared/${SOURCE}$`)
            );
            await expect(
                contentLibraryPage.viewHeading('Tags · Brand hub')
            ).toBeVisible();
            await expect(
                contentLibraryPage.recordLink(SHARED_TAGS[0].name)
            ).toBeVisible();
            await expect(
                contentLibraryPage.sharedTypeLink('Brand hub', 'Tags')
            ).toHaveAttribute('aria-current', 'page');
            // One source, narrowed by the server rather than the page.
            expect(tagScopes.requested).toContain('shared');
            expect(tagScopes.sourceIds).toContain(SOURCE);

            // Nothing that acts on records: no create, no selection, no row
            // actions.
            await expect(contentLibraryPage.addRecord).toHaveCount(0);
            await expect(contentLibraryPage.selectAll).toHaveCount(0);
            await expect(
                contentLibraryPage.rowActionTriggers('Tags')
            ).toHaveCount(0);

            // A row opens the existing read-only entry view.
            await contentLibraryPage.recordLink(SHARED_TAGS[0].name).click();
            await expect(page).toHaveURL(
                new RegExp(`/content/tag/${SHARED_TAGS[0].id}$`)
            );
            await expect(
                contentLibraryPage.sharedEntryNotice('Brand hub')
            ).toBeVisible();
            expect(writes.writes).toEqual([]);
        });

        test('a deep link to a source keeps working; one this workspace isn’t granted says so', async ({
            contentLibraryPage
        }) => {
            await contentLibraryPage.gotoSharedRecords(WS, 'tag', SOURCE);
            await expect(
                contentLibraryPage.viewHeading('Tags · Brand hub')
            ).toBeVisible();

            await contentLibraryPage.gotoSharedRecords(WS, 'tag', 'ws_other');
            await expect(
                contentLibraryPage.paneText('Shared content not available')
            ).toBeVisible();
        });
    });

    test.describe('a type reached only from shared workspaces', () => {
        test('its own list offers no create and points at the source', async ({
            contentLibraryPage
        }) => {
            await contentLibraryPage.gotoRecords(WS, 'tag');

            await expect(
                contentLibraryPage.sharedOnlyNotice('Tags')
            ).toBeVisible();
            await expect(
                contentLibraryPage.sharedOnlyLink('Tags', 'Brand hub')
            ).toHaveAttribute(
                'href',
                `/workspaces/${WS}/content/tag/shared/${SOURCE}`
            );
            await expect(contentLibraryPage.addRecord).toHaveCount(0);
            // The own list asked for own records — none, and no create either.
            expect(tagScopes.requested).toContain(null);
        });

        test('the create editor is not reachable, even by deep link', async ({
            page,
            contentLibraryPage
        }) => {
            await contentLibraryPage.gotoNewEntry(WS, 'tag');

            await expect(page).toHaveURL(
                new RegExp(`/workspaces/${WS}/content/tag$`)
            );
            await expect(
                contentLibraryPage.sharedOnlyNotice('Tags')
            ).toBeVisible();
            await expect(contentLibraryPage.editorSave).toHaveCount(0);
        });

        test('a type with its own grant still offers create', async ({
            contentLibraryPage
        }) => {
            await contentLibraryPage.gotoRecords(WS, 'author');
            await expect(contentLibraryPage.addRecord).toBeVisible();
        });
    });

    test.describe('relation picker', () => {
        test('offers own and shared for a target granted both ways', async ({
            relationsEditorPage
        }) => {
            await relationsEditorPage.gotoNewArticle(WS);
            await relationsEditorPage.openRelationsTab();
            await relationsEditorPage.selectButton('Authors').click();

            await relationsEditorPage.sourceSelect.click();
            await expect(relationsEditorPage.sourceOptions).toHaveText([
                'All',
                'This workspace',
                'Brand hub'
            ]);
        });

        test('offers no "This workspace" for a target reached only from a shared workspace', async ({
            relationsEditorPage
        }) => {
            await relationsEditorPage.gotoNewArticle(WS);
            await relationsEditorPage.openRelationsTab();
            // Tags is the article's one many relation.
            await relationsEditorPage.addRelatedButton.click();

            await expect(relationsEditorPage.sourceSelect).toHaveText('All');
            await expect(
                relationsEditorPage.candidate(SHARED_TAGS[0].name)
            ).toBeVisible();
            await relationsEditorPage.sourceSelect.click();
            await expect(relationsEditorPage.sourceOptions).toHaveText([
                'All',
                'Brand hub'
            ]);
        });
    });

    test('accessibility: the read-only shared list and the sidebar groups', async ({
        contentLibraryPage,
        makeAxe
    }) => {
        await contentLibraryPage.gotoSharedRecords(WS, 'tag', SOURCE);
        await contentLibraryPage.recordLink(SHARED_TAGS[0].name).waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('accessibility: the shared-only notice', async ({
        contentLibraryPage,
        makeAxe
    }) => {
        await contentLibraryPage.gotoRecords(WS, 'tag');
        await contentLibraryPage.sharedOnlyNotice('Tags').waitFor();
        await expectNoA11yViolations(makeAxe());
    });
});
