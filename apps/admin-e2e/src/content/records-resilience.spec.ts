import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    LIBRARY_WORKSPACE,
    mockContentSchema,
    mockContentSchemaDetail,
    mockContentEntries,
    mockContentEntryWrites,
    mockShrinkingEntries
} from '../support/api/content';

/**
 * The records table's **resilience** surfaces — the states a reader reaches by
 * deleting the last row, hand-editing the URL, or losing the catalogue mid-flight.
 * Each case here pins behaviour that used to strand the user on a dead screen or
 * announce nothing at all; the API is mocked at the network layer, so no backend
 * is needed.
 */
test.describe('Records resilience', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockContentSchema(page);
        await mockContentSchemaDetail(page);
        await mockContentEntries(page);
        await mockContentEntryWrites(page);
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
    });

    test('deleting the only row on the last page pulls the pager back instead of stranding it', async ({
        page,
        contentLibraryPage
    }) => {
        // 21 rows at 10 per page → page 3 holds exactly one. The server does not
        // clamp `page` past `pageCount` (it answers with an empty `items` and the
        // true `total`), so the clamp is the admin's job — without it the reader
        // is left on an empty page with the pager hidden and no way back.
        await mockShrinkingEntries(page, { typeName: 'blog_post', count: 21 });
        await page.goto(
            `/workspaces/${LIBRARY_WORKSPACE.id}/content/blog_post?pageSize=10&page=3`
        );

        await expect(contentLibraryPage.pageReadout).toHaveText('Page 3 of 3');
        await expect(contentLibraryPage.recordRows('Blog posts')).toHaveCount(
            1
        );

        await contentLibraryPage.rowActions('Blog posts', 0).click();
        await contentLibraryPage.actionItem('Delete').click();
        await page.getByRole('button', { name: 'Delete', exact: true }).click();

        await expect(page).toHaveURL(/[?&]page=2\b/);
        await expect(contentLibraryPage.pageReadout).toHaveText('Page 2 of 2');
        await expect(contentLibraryPage.recordRows('Blog posts')).toHaveCount(
            10
        );
    });

    test('a page deep-linked past the end is clamped to the last real page', async ({
        page,
        contentLibraryPage
    }) => {
        await mockShrinkingEntries(page, { typeName: 'blog_post', count: 21 });
        await page.goto(
            `/workspaces/${LIBRARY_WORKSPACE.id}/content/blog_post?pageSize=10&page=99`
        );

        await expect(page).toHaveURL(/[?&]page=3\b/);
        await expect(contentLibraryPage.pageReadout).toHaveText('Page 3 of 3');
    });

    test('a pageSize the server would reject falls back to the default rather than an error card', async ({
        page,
        contentLibraryPage
    }) => {
        // The server answers 400 above its cap, so an unchecked `?pageSize=999`
        // rendered the collection's error card with no way out: Retry re-sends
        // the same parameter, and the rows-per-page control lives in a footer
        // that needs rows to exist.
        await mockShrinkingEntries(page, { typeName: 'blog_post', count: 21 });
        await page.goto(
            `/workspaces/${LIBRARY_WORKSPACE.id}/content/blog_post?pageSize=999`
        );

        await expect(contentLibraryPage.recordRows('Blog posts')).toHaveCount(
            10
        );
        await expect(page.getByRole('alert')).toHaveCount(0);
    });

    test('deleting a selected row drops it from the selection', async ({
        page,
        contentLibraryPage
    }) => {
        // Selection is keyed by id and spans pages, so nothing pruned a deleted
        // row: the bar kept counting it and a later bulk action still submitted
        // its id, which the server could only answer "no longer available".
        await mockShrinkingEntries(page, { typeName: 'blog_post', count: 21 });
        await page.goto(
            `/workspaces/${LIBRARY_WORKSPACE.id}/content/blog_post?pageSize=10`
        );

        await contentLibraryPage.rowCheckbox('Blog posts', 0).click();
        await contentLibraryPage.rowCheckbox('Blog posts', 1).click();
        await expect(contentLibraryPage.selectionCount).toHaveText(
            '2 selected'
        );

        await contentLibraryPage.rowActions('Blog posts', 0).click();
        await contentLibraryPage.actionItem('Delete').click();
        await page.getByRole('button', { name: 'Delete', exact: true }).click();

        await expect(contentLibraryPage.selectionCount).toHaveText(
            '1 selected'
        );
    });

    test('focus lands on the records table after a row is deleted', async ({
        page,
        contentLibraryPage
    }) => {
        // The menu item that opened the confirm dialog unmounts with the menu,
        // so Radix has nothing to restore focus to and drops it on `<body>` —
        // the next Tab restarts above the app sidebar.
        await mockShrinkingEntries(page, { typeName: 'blog_post', count: 21 });
        await page.goto(
            `/workspaces/${LIBRARY_WORKSPACE.id}/content/blog_post?pageSize=10`
        );

        await contentLibraryPage.rowActions('Blog posts', 0).click();
        await contentLibraryPage.actionItem('Delete').click();
        await page.getByRole('button', { name: 'Delete', exact: true }).click();

        await expect(
            page.locator('[aria-label="Blog posts records"]:focus')
        ).toHaveCount(1);
    });

    test('every row-actions trigger is named for its own record', async ({
        page,
        contentLibraryPage
    }) => {
        await page.goto(
            `/workspaces/${LIBRARY_WORKSPACE.id}/content/blog_post`
        );

        const triggers = contentLibraryPage.rowActionTriggers('Blog posts');
        await expect(triggers).toHaveCount(10);
        // `aria-label` via the accessibility-facing API rather than the DOM —
        // the e2e tsconfig has no `dom` lib, and the label is what matters.
        const names = await Promise.all(
            (await triggers.all()).map((trigger) =>
                trigger.getAttribute('aria-label')
            )
        );
        // Ten identically-named "Actions for this record" buttons gave a screen
        // reader navigating by control list no way to tell which record it was
        // about to delete.
        expect(new Set(names).size).toBe(names.length);
        expect(names[0]).toBe('Actions for Title 01');
    });

    test('the live region restates the page and the sort, not just the total', async ({
        page,
        contentLibraryPage
    }) => {
        // The region's only content was the total — precisely what neither
        // paging nor sorting changes, so both actions announced nothing.
        await mockShrinkingEntries(page, { typeName: 'blog_post', count: 21 });
        await page.goto(
            `/workspaces/${LIBRARY_WORKSPACE.id}/content/blog_post?pageSize=10`
        );

        await expect(contentLibraryPage.recordsStatus).toContainText(
            'Showing 1–10 of 21, page 1 of 3.'
        );
        await expect(contentLibraryPage.recordsStatus).toContainText(
            'Not sorted.'
        );

        // Activated from the keyboard: the copilot dock floats over the footer,
        // and a forced click would land on the cover rather than the control.
        await contentLibraryPage.nextPage.focus();
        await page.keyboard.press('Enter');
        await expect(contentLibraryPage.recordsStatus).toContainText(
            'Showing 11–20 of 21, page 2 of 3.'
        );

        await contentLibraryPage.columnHeader('Blog posts', 'Title').click();
        await expect(contentLibraryPage.recordsStatus).toContainText(
            'Sorted by Title, ascending.'
        );
    });

    test('boolean and money cells read as answers, not wire values', async ({
        page,
        contentLibraryPage
    }) => {
        // `String(value)` printed the literal English true/false, and every
        // money cell claimed USD for a field spec that carries no currency.
        await page.goto(
            `/workspaces/${LIBRARY_WORKSPACE.id}/content/blog_post`
        );
        // `price` and `published` are already among the default columns, so the
        // first row shows both without touching the picker.
        const firstRow = contentLibraryPage.recordRows('Blog posts').first();
        await expect(firstRow).toContainText('Yes');
        await expect(firstRow).not.toContainText('true');
        // 999 minor units at the kernel's fixed scale of 2, with no invented
        // currency in front of it — the field spec carries none.
        await expect(firstRow).toContainText('9.99');
        await expect(firstRow).not.toContainText('$');
    });

    test('a failed content-type catalogue leaves the sidebar an error, not an absence', async ({
        page,
        contentLibraryPage
    }) => {
        // The section's only failure mode was `return null`: the whole Content
        // nav vanished with no error and no retry, while the pane beside it
        // showed a proper error card.
        await mockContentSchema(page, { status: 500 });
        await page.goto(`/workspaces/${LIBRARY_WORKSPACE.id}/content`);

        // TanStack retries 3× with backoff before surfacing the error, so this
        // needs more than the default assertion timeout.
        await expect(contentLibraryPage.sidebarError).toBeVisible({
            timeout: 15_000
        });
        await expect(contentLibraryPage.sidebar).toHaveCount(0);
    });

    test('the sidebar recovers when its retry succeeds', async ({
        page,
        contentLibraryPage
    }) => {
        await mockContentSchema(page, { status: 500 });
        await page.goto(`/workspaces/${LIBRARY_WORKSPACE.id}/content`);
        await expect(contentLibraryPage.sidebarError).toBeVisible({
            timeout: 15_000
        });

        await mockContentSchema(page);
        await contentLibraryPage.sidebarError
            .getByRole('button', { name: 'Try again' })
            .click();

        await expect(contentLibraryPage.sidebar).toBeVisible();
        await expect(contentLibraryPage.typeLink('Blog posts')).toBeVisible();
    });

    test('the search palette announces how many types match', async ({
        page,
        contentLibraryPage
    }) => {
        // cmdk announces the focused option as the user arrows, but nothing said
        // how many were left — a keystroke that cut twelve rows to one read the
        // same as one that changed nothing.
        await page.goto(`/workspaces/${LIBRARY_WORKSPACE.id}/content`);
        await contentLibraryPage.contentSearchTrigger.click();

        const status =
            contentLibraryPage.searchDialog.locator('p[role="status"]');
        await expect(status).toHaveText('4 content types match.');

        await contentLibraryPage.searchInput.fill('blog');
        await expect(status).toHaveText('1 content type matches.');
    });
});
