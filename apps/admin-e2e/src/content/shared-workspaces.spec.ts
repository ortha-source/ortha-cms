import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces, type WorkspaceView } from '../support/api/workspaces';
import {
    RELATIONS_SCHEMA_SEED,
    RELATIONS_DETAIL_SEED,
    RELATIONS_ENTRIES_SEED,
    RELATION_AUTHOR_IDS,
    mockContentSchema,
    mockContentSchemaDetail,
    mockContentEntries,
    mockContentEntryWrites,
    mockEntryRelations
} from '../support/api/content';
import {
    BRAND_HUB_WORKSPACE,
    FOREIGN_ARTICLE,
    LOCAL_WORKSPACE,
    SHARED_AUTHOR,
    mockEntryUsages,
    mockForeignArticle,
    mockSharedAuthorCandidates,
    spyContentWrites,
    type EntryUsageSeed,
    type SourceScopeSpy
} from '../support/api/sharing';
import { expectNoA11yViolations } from '../support/a11y';
import type { ContentLibraryPage } from '../support/pages/ContentLibraryPage';

type RoutedPage = Parameters<typeof mockWorkspaces>[0];

/** The content seed every case shares; the workspace list is each case's own. */
async function seedContent(page: RoutedPage, workspaces: WorkspaceView[]) {
    await mockSignedIn(page);
    await mockWorkspaces(page, workspaces);
    await mockContentSchema(page, { types: RELATIONS_SCHEMA_SEED });
    await mockContentSchemaDetail(page, { details: RELATIONS_DETAIL_SEED });
    await mockContentEntries(page, {
        details: RELATIONS_DETAIL_SEED,
        entries: RELATIONS_ENTRIES_SEED
    });
    await mockContentEntryWrites(page, { details: RELATIONS_DETAIL_SEED });
    await mockEntryRelations(page);
}

/**
 * **Shared workspaces** in the Content Library (`@orthacms/content-admin`): a
 * shared workspace's published records offered by the relation picker and
 * marked where they are linked, opened read-only inside the linking workspace,
 * and — from the shared workspace's side — the rail's **Used in** block saying
 * who links here. Everything is mocked at the network layer against the frozen
 * wire contract (`source`, `readOnly`, `?source=`, `/usages`).
 */
test.describe('Shared workspaces — content', () => {
    test.describe('relation picker', () => {
        let scopes: SourceScopeSpy;

        test.beforeEach(async ({ page }) => {
            await seedContent(page, [LOCAL_WORKSPACE, BRAND_HUB_WORKSPACE]);
            scopes = await mockSharedAuthorCandidates(page);
        });

        test('offers every source by default and marks the shared records', async ({
            relationsEditorPage
        }) => {
            await relationsEditorPage.gotoNewArticle(LOCAL_WORKSPACE.id);
            await relationsEditorPage.openRelationsTab();
            await relationsEditorPage.selectButton('Authors').click();

            await expect(relationsEditorPage.sourceSelect).toHaveText('All');
            await expect(
                relationsEditorPage.candidate(SHARED_AUTHOR.name)
            ).toBeVisible();
            await expect(
                relationsEditorPage.candidateSharedBadge(
                    SHARED_AUTHOR.name,
                    'Brand hub'
                )
            ).toBeVisible();
            // Only the foreign record carries the mark.
            await expect(relationsEditorPage.candidateSharedBadges).toHaveCount(
                1
            );
            expect(scopes.requested).toContain('all');
        });

        test('narrows to shared records, then to this workspace’s own', async ({
            relationsEditorPage
        }) => {
            await relationsEditorPage.gotoNewArticle(LOCAL_WORKSPACE.id);
            await relationsEditorPage.openRelationsTab();
            await relationsEditorPage.selectButton('Authors').click();
            await expect(
                relationsEditorPage.candidate('Ada Lovelace')
            ).toBeVisible();

            await relationsEditorPage.chooseSource('Shared');
            await expect(relationsEditorPage.sourceSelect).toHaveText('Shared');
            await expect(
                relationsEditorPage.candidate('Ada Lovelace')
            ).toHaveCount(0);
            await expect(
                relationsEditorPage.candidate(SHARED_AUTHOR.name)
            ).toBeVisible();
            expect(scopes.requested.at(-1)).toBe('shared');

            await relationsEditorPage.chooseSource('This workspace');
            await expect(
                relationsEditorPage.candidate(SHARED_AUTHOR.name)
            ).toHaveCount(0);
            await expect(
                relationsEditorPage.candidate('Ada Lovelace')
            ).toBeVisible();
            await expect(relationsEditorPage.candidateSharedBadges).toHaveCount(
                0
            );
            expect(scopes.requested.at(-1)).toBe('own');
        });

        test('a linked shared record keeps its mark and opens inside this workspace', async ({
            relationsEditorPage
        }) => {
            await relationsEditorPage.gotoNewArticle(LOCAL_WORKSPACE.id);
            await relationsEditorPage.openRelationsTab();
            await relationsEditorPage.selectButton('Authors').click();

            await relationsEditorPage.candidate(SHARED_AUTHOR.name).click();

            await expect(relationsEditorPage.dialog).toBeHidden();
            await expect(
                relationsEditorPage.assignedSharedBadge('Brand hub')
            ).toBeVisible();
            // The current workspace's route, where the record opens read-only
            // — not the source workspace, which the reader may not belong to.
            await expect(
                relationsEditorPage.openLink(SHARED_AUTHOR.name)
            ).toHaveAttribute(
                'href',
                `/workspaces/${LOCAL_WORKSPACE.id}/content/author/${SHARED_AUTHOR.id}`
            );
        });

        test('keyboard: the Source select opens, moves and commits without a mouse', async ({
            page,
            relationsEditorPage
        }) => {
            await relationsEditorPage.gotoNewArticle(LOCAL_WORKSPACE.id);
            await relationsEditorPage.openRelationsTab();
            await relationsEditorPage.selectButton('Authors').click();

            await relationsEditorPage.sourceSelect.focus();
            await page.keyboard.press('Enter');
            // Radix moves focus onto the selected option once the listbox has
            // opened; arrowing before that lands nowhere.
            await expect(relationsEditorPage.sourceOption('All')).toBeFocused();
            await page.keyboard.press('ArrowDown');
            await expect(
                relationsEditorPage.sourceOption('This workspace')
            ).toBeFocused();
            await page.keyboard.press('ArrowDown');
            await expect(
                relationsEditorPage.sourceOption('Shared')
            ).toBeFocused();
            await page.keyboard.press('Enter');

            await expect(relationsEditorPage.sourceSelect).toHaveText('Shared');
            await expect(relationsEditorPage.sourceSelect).toBeFocused();
            // Still inside the picker — the select's Escape/Enter did not
            // dismiss the dialog around it.
            await expect(relationsEditorPage.dialog).toBeVisible();
        });

        test('accessibility: the picker with shared records', async ({
            relationsEditorPage,
            makeAxe
        }) => {
            await relationsEditorPage.gotoNewArticle(LOCAL_WORKSPACE.id);
            await relationsEditorPage.openRelationsTab();
            await relationsEditorPage.selectButton('Authors').click();
            await relationsEditorPage
                .candidateSharedBadge(SHARED_AUTHOR.name, 'Brand hub')
                .waitFor();
            await expectNoA11yViolations(makeAxe());
        });
    });

    test.describe('a shared record opened in another workspace', () => {
        test('is a read-only view that says where it lives', async ({
            page,
            contentLibraryPage,
            relationsEditorPage
        }) => {
            await seedContent(page, [LOCAL_WORKSPACE, BRAND_HUB_WORKSPACE]);
            await mockForeignArticle(page);
            const writes = spyContentWrites(page);

            await contentLibraryPage.gotoEntry(
                LOCAL_WORKSPACE.id,
                'article',
                FOREIGN_ARTICLE.id
            );

            await expect(
                contentLibraryPage.sharedEntryNotice('Brand hub')
            ).toBeVisible();
            await expect(
                contentLibraryPage.sharedEntryReadOnlyText
            ).toBeVisible();
            // A member of the source gets the way to where it is edited.
            await expect(contentLibraryPage.openInSourceLink).toHaveAttribute(
                'href',
                `/workspaces/${BRAND_HUB_WORKSPACE.id}/content/article/${FOREIGN_ARTICLE.id}`
            );

            // The values are there to read; nothing takes input.
            const title = contentLibraryPage.fieldTextbox('Title', {
                exact: true
            });
            await expect(title).toHaveValue(FOREIGN_ARTICLE.title);
            await expect(title).toHaveAttribute('readonly', '');
            await title.click();
            await title.pressSequentially(' — edited');
            await expect(title).toHaveValue(FOREIGN_ARTICLE.title);
            // Enter in a text field is the one save path with no button.
            await title.press('Enter');

            // No actions at all — not even the menu.
            await expect(contentLibraryPage.editorSave).toHaveCount(0);
            await expect(contentLibraryPage.editorMoreActions).toHaveCount(0);
            // A shared record's history (and its drafts) stays at its source.
            await expect(contentLibraryPage.editorTab('History')).toHaveCount(
                0
            );

            // Details names the source.
            await expect(contentLibraryPage.railRow('Source')).toContainText(
                'Brand hub'
            );

            // Relations read, but offer nothing to change.
            await contentLibraryPage.openEditorTab('Relations');
            await expect(relationsEditorPage.section('Author')).toBeVisible();
            await expect(
                relationsEditorPage.selectButton('Authors')
            ).toHaveCount(0);

            expect(writes.writes).toEqual([]);
        });

        test('offers no way to the source to someone who is not a member of it', async ({
            page,
            contentLibraryPage
        }) => {
            await seedContent(page, [LOCAL_WORKSPACE]);
            await mockForeignArticle(page);

            await contentLibraryPage.gotoEntry(
                LOCAL_WORKSPACE.id,
                'article',
                FOREIGN_ARTICLE.id
            );

            await expect(
                contentLibraryPage.sharedEntryNotice('Brand hub')
            ).toBeVisible();
            await expect(contentLibraryPage.openInSourceLink).toHaveCount(0);
        });

        test('a deep link to History lands on General', async ({
            page,
            contentLibraryPage
        }) => {
            await seedContent(page, [LOCAL_WORKSPACE, BRAND_HUB_WORKSPACE]);
            await mockForeignArticle(page);

            await page.goto(
                `/workspaces/${LOCAL_WORKSPACE.id}/content/article/${FOREIGN_ARTICLE.id}/history`
            );

            await expect(
                contentLibraryPage.editorTab('General')
            ).toHaveAttribute('aria-selected', 'true');
        });

        test('accessibility: the read-only view', async ({
            page,
            contentLibraryPage,
            makeAxe
        }) => {
            await seedContent(page, [LOCAL_WORKSPACE, BRAND_HUB_WORKSPACE]);
            await mockForeignArticle(page);

            await contentLibraryPage.gotoEntry(
                LOCAL_WORKSPACE.id,
                'article',
                FOREIGN_ARTICLE.id
            );
            await contentLibraryPage.openInSourceLink.waitFor();
            await expectNoA11yViolations(makeAxe());
        });
    });

    test.describe('Used in (the shared workspace’s own record)', () => {
        const USAGES: EntryUsageSeed[] = [
            {
                workspaceId: LOCAL_WORKSPACE.id,
                workspaceName: LOCAL_WORKSPACE.name,
                count: 2
            },
            { workspaceId: 'ws_docs', workspaceName: 'Product docs', count: 1 }
        ];

        async function openOwnAuthor(
            workspaceId: string,
            contentLibraryPage: ContentLibraryPage
        ) {
            await contentLibraryPage.gotoEntry(
                workspaceId,
                'author',
                RELATION_AUTHOR_IDS.ada
            );
            await contentLibraryPage.railBlock('Details').waitFor();
        }

        test('lists every linking workspace and warns that publishing reaches them', async ({
            page,
            contentLibraryPage
        }) => {
            await seedContent(page, [BRAND_HUB_WORKSPACE, LOCAL_WORKSPACE]);
            await mockEntryUsages(page, { items: USAGES });

            await openOwnAuthor(BRAND_HUB_WORKSPACE.id, contentLibraryPage);

            await expect(contentLibraryPage.railBlock('Used in')).toBeVisible();
            await expect(
                contentLibraryPage.railRow(LOCAL_WORKSPACE.name)
            ).toContainText('2 links');
            await expect(
                contentLibraryPage.railRow('Product docs')
            ).toContainText('1 link');
            await expect(contentLibraryPage.usedInPublishNote).toHaveText(
                'Publishing updates 2 workspaces'
            );
        });

        test('says nothing when nobody links here', async ({
            page,
            contentLibraryPage
        }) => {
            await seedContent(page, [BRAND_HUB_WORKSPACE, LOCAL_WORKSPACE]);
            const usages = await mockEntryUsages(page, { items: [] });

            await openOwnAuthor(BRAND_HUB_WORKSPACE.id, contentLibraryPage);

            await expect.poll(() => usages.calls).toBeGreaterThan(0);
            await expect(contentLibraryPage.railBlock('Used in')).toHaveCount(
                0
            );
        });

        test('hides itself rather than reporting a failed read', async ({
            page,
            contentLibraryPage
        }) => {
            await seedContent(page, [BRAND_HUB_WORKSPACE, LOCAL_WORKSPACE]);
            const usages = await mockEntryUsages(page, { status: 500 });

            await openOwnAuthor(BRAND_HUB_WORKSPACE.id, contentLibraryPage);

            await expect.poll(() => usages.calls).toBeGreaterThan(0);
            await expect(contentLibraryPage.railBlock('Used in')).toHaveCount(
                0
            );
            await expect(contentLibraryPage.usedInPublishNote).toHaveCount(0);
        });

        test('is never asked for outside a shared workspace', async ({
            page,
            contentLibraryPage
        }) => {
            await seedContent(page, [LOCAL_WORKSPACE, BRAND_HUB_WORKSPACE]);
            const usages = await mockEntryUsages(page, { items: USAGES });

            await openOwnAuthor(LOCAL_WORKSPACE.id, contentLibraryPage);

            await expect(contentLibraryPage.railBlock('Used in')).toHaveCount(
                0
            );
            expect(usages.calls).toBe(0);
        });

        test('accessibility: the rail with the Used in block', async ({
            page,
            contentLibraryPage,
            makeAxe
        }) => {
            await seedContent(page, [BRAND_HUB_WORKSPACE, LOCAL_WORKSPACE]);
            await mockEntryUsages(page, { items: USAGES });

            await openOwnAuthor(BRAND_HUB_WORKSPACE.id, contentLibraryPage);
            await contentLibraryPage.usedInPublishNote.waitFor();
            await expectNoA11yViolations(makeAxe());
        });
    });
});
