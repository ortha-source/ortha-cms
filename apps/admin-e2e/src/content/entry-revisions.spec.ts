import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    LIBRARY_WORKSPACE,
    mockContentSchema,
    mockContentSchemaDetail,
    mockContentEntries,
    mockEntryRelations
} from '../support/api/content';
import { mockEntryRevisionFlow } from '../support/api/revisions';

/** A blog post seeded as **published** for the draft-save regression. */
const PUBLISHED_ID = 'blog_post-live';
/** A blog post seeded as a **draft** for the publish-a-version flow. */
const DRAFT_ID = 'blog_post-draft';

/**
 * The entry editor's **revision history** — the version timeline in the History
 * tab, its Live/Draft badges, and the publish-a-version action. Backed by
 * {@link mockEntryRevisionFlow}, a stateful mock that mutates the timeline the
 * way the API does (a save appends a draft without demoting the live version; a
 * publish promotes a version and supersedes the prior one), so these assert the
 * real outcome of each admin flow.
 */
test.describe('Entry revision history', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await mockContentSchema(page);
        await mockContentSchemaDetail(page);
        await mockContentEntries(page);
        // The editor loads relations on open; blog_post has none, so serve empty
        // (keeps the request off the dev proxy).
        await mockEntryRelations(page);
    });

    test('saving a draft keeps the published version live', async ({
        page,
        contentLibraryPage
    }) => {
        const flow = await mockEntryRevisionFlow(page, {
            name: 'blog_post',
            id: PUBLISHED_ID,
            values: { title: 'Launch announcement' }
        });

        await contentLibraryPage.gotoEntry(
            LIBRARY_WORKSPACE.id,
            'blog_post',
            PUBLISHED_ID
        );

        // Baseline: the entry has one version, and it is Live.
        await contentLibraryPage.openEditorTab('History');
        await expect(contentLibraryPage.liveRevisionBadges).toHaveCount(1);
        await expect(
            contentLibraryPage
                .revisionItem(1)
                .getByText('Live', { exact: true })
        ).toBeVisible();

        // Edit the title on the General tab, then Save as a draft.
        await contentLibraryPage.openEditorTab('General');
        await contentLibraryPage
            .fieldTextbox('Title')
            .fill('Launch announcement v2');
        await contentLibraryPage.saveDraft();

        // The regression: the previously-published version stays Live — a new
        // draft is appended *ahead* of it, and the save never unpublished it.
        // (The `v2` assertion waits out the save's refetch.)
        await contentLibraryPage.openEditorTab('History');
        await expect(
            contentLibraryPage
                .revisionItem(2)
                .getByText('Draft', { exact: true })
        ).toBeVisible();
        await expect(contentLibraryPage.liveRevisionBadges).toHaveCount(1);
        await expect(
            contentLibraryPage
                .revisionItem(1)
                .getByText('Live', { exact: true })
        ).toBeVisible();
        // Direct signal: a draft-save must not hit the unpublish endpoint.
        expect(flow.unpublishCalls).toBe(0);
    });

    test('publishing a version from history makes it live', async ({
        page,
        contentLibraryPage
    }) => {
        await mockEntryRevisionFlow(page, {
            name: 'blog_post',
            id: DRAFT_ID,
            values: { title: 'Draft only' },
            startPublished: false
        });

        await contentLibraryPage.gotoEntry(
            LIBRARY_WORKSPACE.id,
            'blog_post',
            DRAFT_ID
        );
        await contentLibraryPage.openEditorTab('History');

        // The only version starts as a draft — nothing is Live yet.
        await expect(contentLibraryPage.liveRevisionBadges).toHaveCount(0);

        // Publish that version from the timeline (row action + confirm).
        await contentLibraryPage.publishRevision(1);

        // It is now the entry's live version.
        await expect(
            contentLibraryPage
                .revisionItem(1)
                .getByText('Live', { exact: true })
        ).toBeVisible();
        await expect(contentLibraryPage.liveRevisionBadges).toHaveCount(1);
    });
});
