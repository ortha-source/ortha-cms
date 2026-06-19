import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    LIBRARY_WORKSPACE,
    SCOPED_WORKSPACE,
    UNGRANTED_WORKSPACE,
    mockContentSchema
} from '../support/api/content';

/**
 * The Content Library at `/workspaces/:id/content` — the second-sidebar nav
 * (collapsible Collections/Pages, Favorites, Manage), the ⌘K search palette, the
 * selected-type pane, and per-workspace scoping. The API is mocked at the network
 * layer, so no backend is needed.
 */
test.describe('Content Library', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockContentSchema(page);
    });

    test('renders the sidebar with Workspace and Manage sections', async ({
        page,
        contentLibraryPage
    }) => {
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        await expect(contentLibraryPage.sidebar).toBeVisible();
        await expect(
            contentLibraryPage.sectionLabel('Workspace')
        ).toBeVisible();
        await expect(contentLibraryPage.group('Collections')).toBeVisible();
        await expect(contentLibraryPage.group('Pages')).toBeVisible();
        // Manage section with its two static links.
        await expect(contentLibraryPage.sectionLabel('Manage')).toBeVisible();
        await expect(contentLibraryPage.manageLink('History')).toBeVisible();
        await expect(contentLibraryPage.manageLink('Trash')).toBeVisible();
        // No favorites pinned yet → the Favorites section is absent.
        await expect(contentLibraryPage.sectionLabel('Favorites')).toHaveCount(
            0
        );
    });

    test('groups start collapsed and expand on click', async ({
        page,
        contentLibraryPage
    }) => {
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        // Collapsed by default — the type rows are hidden.
        await expect(contentLibraryPage.typeLink('Blog posts')).toBeHidden();
        await contentLibraryPage.expandGroup('Collections');
        await expect(contentLibraryPage.typeLink('Blog posts')).toBeVisible();
        await expect(contentLibraryPage.typeLink('Products')).toBeVisible();
    });

    test('selecting a type shows its placeholder pane', async ({
        page,
        contentLibraryPage
    }) => {
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        await contentLibraryPage.expandGroup('Collections');
        await contentLibraryPage.typeLink('Blog posts').click();

        await expect(
            contentLibraryPage.viewHeading('Blog posts')
        ).toBeVisible();
        await expect(
            contentLibraryPage.paneText('Entries coming soon')
        ).toBeVisible();
        await expect(page).toHaveURL(/\/content\/blog_post$/);
    });

    test('only shows content types granted to the workspace', async ({
        page,
        contentLibraryPage
    }) => {
        // Scoped workspace is granted blog_post + home only.
        await mockWorkspaces(page, [SCOPED_WORKSPACE]);
        await contentLibraryPage.goto(SCOPED_WORKSPACE.id);

        await contentLibraryPage.expandGroup('Collections');
        await contentLibraryPage.expandGroup('Pages');

        await expect(contentLibraryPage.typeLink('Blog posts')).toBeVisible();
        await expect(contentLibraryPage.typeLink('Home')).toBeVisible();
        // Ungranted types are filtered out.
        await expect(contentLibraryPage.typeLink('Products')).toHaveCount(0);
        await expect(contentLibraryPage.typeLink('About')).toHaveCount(0);
    });

    test('pinning a type adds it to a Favorites section', async ({
        page,
        contentLibraryPage
    }) => {
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        await contentLibraryPage.expandGroup('Collections');
        await contentLibraryPage.pinToggle('Blog posts').click();

        await expect(
            contentLibraryPage.sectionLabel('Favorites')
        ).toBeVisible();
        // The pinned row now also appears under Favorites (two matches total).
        await expect(contentLibraryPage.typeLink('Blog posts')).toHaveCount(2);
    });

    test('opens the search palette and navigates to a type', async ({
        page,
        contentLibraryPage
    }) => {
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        await contentLibraryPage.openSearch();
        await contentLibraryPage.searchInput.fill('Products');
        await contentLibraryPage.searchOption('Products').click();

        await expect(contentLibraryPage.searchDialog).toBeHidden();
        await expect(contentLibraryPage.viewHeading('Products')).toBeVisible();
        await expect(page).toHaveURL(/\/content\/product$/);
    });

    test('the Ctrl/⌘+K shortcut opens and Escape closes the palette', async ({
        page,
        contentLibraryPage
    }) => {
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        await contentLibraryPage.openSearchByShortcut();
        await expect(contentLibraryPage.searchInput).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(contentLibraryPage.searchDialog).toBeHidden();
    });

    test('shows the empty state when the workspace has no content', async ({
        page,
        contentLibraryPage
    }) => {
        await mockWorkspaces(page, [UNGRANTED_WORKSPACE]);
        await contentLibraryPage.goto(UNGRANTED_WORKSPACE.id);

        await expect(contentLibraryPage.emptyTitle).toBeVisible();
        await expect(contentLibraryPage.sidebar).toHaveCount(0);
    });

    test('shows the error state and recovers on retry', async ({
        page,
        contentLibraryPage
    }) => {
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await mockContentSchema(page, { status: 500 });
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        // TanStack Query retries (3×, exponential backoff) before surfacing the
        // error, so allow more than the default assertion timeout.
        await expect(contentLibraryPage.errorTitle).toBeVisible({
            timeout: 15_000
        });

        // Recover: the next fetch succeeds, and retry re-renders the sidebar.
        await mockContentSchema(page);
        await contentLibraryPage.retry.click();
        await expect(contentLibraryPage.sidebar).toBeVisible();
    });
});
