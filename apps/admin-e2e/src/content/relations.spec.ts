import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    RELATIONS_WORKSPACE,
    RELATIONS_SCOPED_WORKSPACE,
    RELATIONS_SCHEMA_SEED,
    RELATIONS_DETAIL_SEED,
    RELATIONS_ENTRIES_SEED,
    mockContentSchema,
    mockContentSchemaDetail,
    mockContentEntries,
    mockContentEntryWrites,
    mockEntryRelations,
    spyEntrySave
} from '../support/api/content';
import { expectNoA11yViolations } from '../support/a11y';

/**
 * The relation picker in the entry editor's Relations tab (from
 * `@ortha-cms/content-admin`): assigning single + many relations by **title**,
 * searching and lazily scrolling candidates, the query-builder filter drawer,
 * removing links, and accessibility. The schema **and** the candidate rows are
 * mocked at the network layer — candidates come from `GET /api/content/:type`
 * (`RELATIONS_ENTRIES_SEED`), the same list endpoint the records table uses.
 */
test.describe('Relation picker', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [RELATIONS_WORKSPACE]);
        await mockContentSchema(page, { types: RELATIONS_SCHEMA_SEED });
        await mockContentSchemaDetail(page, { details: RELATIONS_DETAIL_SEED });
        // Candidate rows come from the real list endpoint now; seed recognizable
        // titles (Ada Lovelace, engineering, …) via the entries override.
        await mockContentEntries(page, {
            details: RELATIONS_DETAIL_SEED,
            entries: RELATIONS_ENTRIES_SEED
        });
        await mockContentEntryWrites(page, { details: RELATIONS_DETAIL_SEED });
        await mockEntryRelations(page);
    });

    test('renders each relation field as a collapsible section', async ({
        relationsEditorPage
    }) => {
        await relationsEditorPage.gotoNewArticle(RELATIONS_WORKSPACE.id);
        await relationsEditorPage.openRelationsTab();

        await expect(relationsEditorPage.section('Author')).toBeVisible();
        await expect(relationsEditorPage.section('Tags')).toBeVisible();
        // Sections start open (≤3 relation fields), so the triggers show.
        await expect(relationsEditorPage.selectButton('Authors')).toBeVisible();
        await expect(relationsEditorPage.addRelatedButton).toBeVisible();
        await expect(relationsEditorPage.nothingLinked.first()).toBeVisible();
    });

    test('assigns a single relation and shows it by title', async ({
        relationsEditorPage
    }) => {
        await relationsEditorPage.gotoNewArticle(RELATIONS_WORKSPACE.id);
        await relationsEditorPage.openRelationsTab();

        await relationsEditorPage.selectButton('Authors').click();
        await expect(relationsEditorPage.dialog).toBeVisible();
        // Picking a single relation commits immediately and closes the dialog.
        await relationsEditorPage.candidate('Ada Lovelace').click();

        await expect(relationsEditorPage.dialog).toBeHidden();
        await expect(
            relationsEditorPage.assignedRemove('Ada Lovelace')
        ).toBeVisible();
    });

    test('assigns multiple records to a many relation', async ({
        relationsEditorPage
    }) => {
        await relationsEditorPage.gotoNewArticle(RELATIONS_WORKSPACE.id);
        await relationsEditorPage.openRelationsTab();

        await relationsEditorPage.addRelatedButton.click();
        await relationsEditorPage.candidate('engineering').click();
        await relationsEditorPage.candidate('design').click();
        // The commit button reflects the staged count.
        await expect(relationsEditorPage.addSelectedButton).toHaveText(/Add 2/);
        await relationsEditorPage.addSelectedButton.click();

        await expect(relationsEditorPage.dialog).toBeHidden();
        await expect(
            relationsEditorPage.assignedRemove('engineering')
        ).toBeVisible();
        await expect(
            relationsEditorPage.assignedRemove('design')
        ).toBeVisible();
        // A many relation's rows are reorderable (a drag handle per row).
        await expect(
            relationsEditorPage.dragHandle('engineering')
        ).toBeVisible();
    });

    test('offers an open-in-new-tab link on candidate and assigned rows', async ({
        relationsEditorPage
    }) => {
        await relationsEditorPage.gotoNewArticle(RELATIONS_WORKSPACE.id);
        await relationsEditorPage.openRelationsTab();

        await relationsEditorPage.selectButton('Authors').click();
        // Each candidate row in the search window links to that record's editor.
        const candidateLink =
            relationsEditorPage.candidateOpenLink('Ada Lovelace');
        await expect(candidateLink).toBeVisible();
        await expect(candidateLink).toHaveAttribute('target', '_blank');
        await expect(candidateLink).toHaveAttribute(
            'href',
            `/workspaces/${RELATIONS_WORKSPACE.id}/content/author/author-ada`
        );

        // The same link rides on the assigned preview row after picking.
        await relationsEditorPage.candidate('Ada Lovelace').click();
        const previewLink = relationsEditorPage.openLink('Ada Lovelace');
        await expect(previewLink).toBeVisible();
        await expect(previewLink).toHaveAttribute('target', '_blank');
        await expect(previewLink).toHaveAttribute(
            'href',
            `/workspaces/${RELATIONS_WORKSPACE.id}/content/author/author-ada`
        );
    });

    test('searches to narrow the candidate list', async ({
        relationsEditorPage
    }) => {
        await relationsEditorPage.gotoNewArticle(RELATIONS_WORKSPACE.id);
        await relationsEditorPage.openRelationsTab();

        await relationsEditorPage.addRelatedButton.click();
        await relationsEditorPage.dialogSearch.fill('design');

        await expect(relationsEditorPage.candidateOptions).toHaveCount(1);
        await expect(relationsEditorPage.candidate('design')).toBeVisible();
        await expect(relationsEditorPage.candidate('engineering')).toHaveCount(
            0
        );
    });

    test('lazily loads more candidates as the list scrolls', async ({
        relationsEditorPage
    }) => {
        await relationsEditorPage.gotoNewArticle(RELATIONS_WORKSPACE.id);
        await relationsEditorPage.openRelationsTab();

        await relationsEditorPage.addRelatedButton.click();
        // The tag target has 32 rows; the first window is 12.
        await expect(relationsEditorPage.candidateOptions).toHaveCount(12);
        await expect(relationsEditorPage.recordsCount).toHaveText(/32 records/);

        // Scrolling to the bottom trips the lazy-load sentinel, revealing more.
        await expect
            .poll(
                async () => {
                    await relationsEditorPage.scrollCandidatesToBottom();
                    return relationsEditorPage.candidateOptions.count();
                },
                { timeout: 10_000 }
            )
            .toBeGreaterThan(12);
    });

    test('reveals the inline query-builder filter over the target schema', async ({
        relationsEditorPage
    }) => {
        await relationsEditorPage.gotoNewArticle(RELATIONS_WORKSPACE.id);
        await relationsEditorPage.openRelationsTab();

        await relationsEditorPage.addRelatedButton.click();
        // The filter is a disclosure *inside* the one dialog — no nested drawer.
        await relationsEditorPage.filtersButton.click();
        await expect(relationsEditorPage.addRuleButton).toBeVisible();
    });

    test('edits a bidirectional (inverse) relation from the other side', async ({
        relationsEditorPage
    }) => {
        // `tag.articles` is the inverse of `article.tags` — the same link,
        // editable from the tag side.
        await relationsEditorPage.gotoNewType(RELATIONS_WORKSPACE.id, 'tag');
        await relationsEditorPage.openRelationsTab();

        // The inverse renders as a normal relation section targeting articles.
        await expect(relationsEditorPage.section('Articles')).toBeVisible();
        await relationsEditorPage.addRelatedButton.click();
        await expect(
            relationsEditorPage.candidate('Getting started with Ortha')
        ).toBeVisible();
        await relationsEditorPage
            .candidate('Getting started with Ortha')
            .click();
        await relationsEditorPage.addSelectedButton.click();

        await expect(
            relationsEditorPage.assignedRemove('Getting started with Ortha')
        ).toBeVisible();
    });

    test('hides relations whose target collection the workspace lacks', async ({
        page,
        relationsEditorPage
    }) => {
        // Scoped workspace grants article/author/seo_meta but not `tag`.
        await mockWorkspaces(page, [RELATIONS_SCOPED_WORKSPACE]);
        await relationsEditorPage.gotoNewArticle(RELATIONS_SCOPED_WORKSPACE.id);
        await relationsEditorPage.openRelationsTab();

        await expect(relationsEditorPage.section('Author')).toBeVisible();
        await expect(relationsEditorPage.section('SEO metadata')).toBeVisible();
        // `tags` targets the ungranted `tag` collection → hidden.
        await expect(relationsEditorPage.section('Tags')).toHaveCount(0);
        await expect(relationsEditorPage.addRelatedButton).toHaveCount(0);
    });

    test('saves staged links as a relations delta, omitting them from values', async ({
        page,
        relationsEditorPage
    }) => {
        const spy = await spyEntrySave(page);
        await relationsEditorPage.gotoNewArticle(RELATIONS_WORKSPACE.id);
        await relationsEditorPage.openRelationsTab();

        // Stage two tags (nothing sent yet — staged locally).
        await relationsEditorPage.addRelatedButton.click();
        await relationsEditorPage.candidate('engineering').click();
        await relationsEditorPage.candidate('design').click();
        await relationsEditorPage.addSelectedButton.click();
        await expect(spy.bodies).toHaveLength(0);

        // Save (draft) flushes them as a delta in the save payload.
        await relationsEditorPage.saveDraft();
        await expect.poll(() => spy.bodies.length).toBeGreaterThan(0);

        const body = spy.bodies[0];
        expect(body.relations?.tags?.link?.slice().sort()).toEqual([
            'tag-01',
            'tag-02'
        ]);
        // A link-managed relation must NOT ride in `values` (that path replaces
        // the whole set and would wipe links on a later save).
        expect('tags' in body.values).toBe(false);
    });

    test('shows a "Changed" badge on a relation with staged edits', async ({
        relationsEditorPage
    }) => {
        await relationsEditorPage.gotoNewArticle(RELATIONS_WORKSPACE.id);
        await relationsEditorPage.openRelationsTab();
        await expect(relationsEditorPage.changedBadge).toHaveCount(0);

        await relationsEditorPage.addRelatedButton.click();
        await relationsEditorPage.candidate('engineering').click();
        await relationsEditorPage.addSelectedButton.click();

        await expect(relationsEditorPage.changedBadge.first()).toBeVisible();
    });

    test('removes an assigned relation', async ({ relationsEditorPage }) => {
        await relationsEditorPage.gotoNewArticle(RELATIONS_WORKSPACE.id);
        await relationsEditorPage.openRelationsTab();

        await relationsEditorPage.selectButton('Authors').click();
        await relationsEditorPage.candidate('Ada Lovelace').click();
        await expect(
            relationsEditorPage.assignedRemove('Ada Lovelace')
        ).toBeVisible();

        await relationsEditorPage.assignedRemove('Ada Lovelace').click();
        await expect(
            relationsEditorPage.assignedRemove('Ada Lovelace')
        ).toHaveCount(0);
        // Back to the empty trigger.
        await expect(relationsEditorPage.selectButton('Authors')).toBeVisible();
    });
});

/**
 * Accessibility scans (axe, WCAG 2.1 A/AA) of the Relations tab and the open
 * relation picker — a regression guard, not a conformance claim.
 */
test.describe('Relation picker accessibility (axe, WCAG 2.1 A/AA)', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [RELATIONS_WORKSPACE]);
        await mockContentSchema(page, { types: RELATIONS_SCHEMA_SEED });
        await mockContentSchemaDetail(page, { details: RELATIONS_DETAIL_SEED });
        // Candidate rows come from the real list endpoint now; seed recognizable
        // titles (Ada Lovelace, engineering, …) via the entries override.
        await mockContentEntries(page, {
            details: RELATIONS_DETAIL_SEED,
            entries: RELATIONS_ENTRIES_SEED
        });
        await mockContentEntryWrites(page, { details: RELATIONS_DETAIL_SEED });
        await mockEntryRelations(page);
    });

    test('relations tab — field sections', async ({
        relationsEditorPage,
        makeAxe
    }) => {
        await relationsEditorPage.gotoNewArticle(RELATIONS_WORKSPACE.id);
        await relationsEditorPage.openRelationsTab();
        await relationsEditorPage.section('Tags').waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('relation picker — open', async ({ relationsEditorPage, makeAxe }) => {
        await relationsEditorPage.gotoNewArticle(RELATIONS_WORKSPACE.id);
        await relationsEditorPage.openRelationsTab();
        await relationsEditorPage.addRelatedButton.click();
        await relationsEditorPage.candidate('engineering').waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('relation picker — inline filter open', async ({
        relationsEditorPage,
        makeAxe
    }) => {
        await relationsEditorPage.gotoNewArticle(RELATIONS_WORKSPACE.id);
        await relationsEditorPage.openRelationsTab();
        await relationsEditorPage.addRelatedButton.click();
        await relationsEditorPage.filtersButton.click();
        await relationsEditorPage.addRuleButton.waitFor();
        await expectNoA11yViolations(makeAxe());
    });
});
