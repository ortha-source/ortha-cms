import { test, expect } from '../support/fixtures';
import { expectNoA11yViolations } from '../support/a11y';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    LIBRARY_WORKSPACE,
    mockContentSchema,
    mockContentSchemaDetail,
    mockContentEntries,
    mockContentEntryWrites
} from '../support/api/content';

/**
 * The **publish-guard slot's empty state**, in a real browser — invariant
 * `protection:I-03`.
 *
 * `ENTRY_PUBLISH_GUARD_SLOT` exists for one plugin, and no plugin fills it in
 * this app yet. So the only thing there is to test here is also the thing worth
 * testing most: that adding the seam changed nothing. The component spec beside
 * `EntryActions` pins the same rule against a registry it can populate; this
 * pins it against the app as it actually boots, where the registry is empty
 * because nobody contributed rather than because a test cleared it.
 *
 * Both halves matter. A `disabled` attribute or an `aria-disabled` appearing on
 * the primary button would be the regression; so would the button quietly
 * losing its keyboard route, which is the failure the slot's design was shaped
 * to avoid in the first place.
 */
test.describe('Entry editor publish button, with no guard contributed', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await mockContentSchema(page);
        await mockContentSchemaDetail(page);
        await mockContentEntries(page);
        await mockContentEntryWrites(page);
    });

    test('carries no refusal and no description [protection:I-03]', async ({
        contentLibraryPage
    }) => {
        await contentLibraryPage.gotoNewEntry(
            LIBRARY_WORKSPACE.id,
            'blog_post'
        );

        const publish = contentLibraryPage.editorSave;
        await expect(publish).toBeVisible();
        await expect(publish).toBeEnabled();
        // The two attributes a contribution adds. Absent here means the empty
        // slot really is inert, rather than merely looking that way.
        await expect(publish).not.toHaveAttribute('aria-disabled', /.*/);
        await expect(publish).not.toHaveAttribute('aria-describedby', /.*/);
    });

    test('stays reachable and activatable from the keyboard', async ({
        contentLibraryPage,
        page
    }) => {
        await contentLibraryPage.gotoNewEntry(
            LIBRARY_WORKSPACE.id,
            'blog_post'
        );

        // The publish **gate** is the second of the three, and it runs whatever
        // this slot says — a blank draft is refused for its own reasons, which
        // would make the assertion below say nothing about the guard.
        await contentLibraryPage
            .fieldTextbox('Title')
            .fill('Keyboard reachable');

        const publish = contentLibraryPage.editorSave;
        await expect(publish).toBeVisible();

        await publish.focus();
        await expect(publish).toBeFocused();

        // A control that cannot be operated by Enter is not operable; the point
        // of `aria-disabled` over `disabled` in the blocked case is that this
        // route survives, so the unblocked case has to have it to begin with.
        const write = page.waitForRequest(
            (request) =>
                request.method() === 'POST' &&
                /\/api\/content\/blog_post(\?|$)/.test(request.url())
        );
        await page.keyboard.press('Enter');
        await write;
    });

    test('has no accessibility violations in the editor', async ({
        contentLibraryPage,
        makeAxe
    }) => {
        await contentLibraryPage.gotoNewEntry(
            LIBRARY_WORKSPACE.id,
            'blog_post'
        );
        await expect(contentLibraryPage.editorSave).toBeVisible();

        await expectNoA11yViolations(makeAxe());
    });
});
