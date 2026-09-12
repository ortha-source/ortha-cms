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
import { mockNewEntryProtection } from '../support/api/protection';

/**
 * The publish button **with the guard contributed but silent** — the client half
 * of invariant `protection:I-04`: with no rule on the type, the editor is the
 * one it was before the plugin was installed.
 *
 * This file used to claim it tested the *empty* slot (`protection:I-03`), and
 * that was false from the day it was written: `apps/admin/src/plugins.ts`
 * registers `ProtectionPlugin()`, in the same commit as this spec. The slot is
 * filled, `usePublishProtectionVerdict` runs, and it reads
 * `GET /api/protection/types/blog_post` — which nothing here mocked, so the
 * request fell through to the dev proxy, failed, and the hook returned `null`.
 * The assertions below passed because the read **broke**, not because the slot
 * was empty: a guard that blocked the button on a failed read would have been
 * caught by nothing. So the read is mocked now, as an unprotected type, which is
 * the state the assertions are actually about.
 *
 * I-03 — the slot carrying no contribution at all — cannot be expressed against
 * an app that registers the plugin. It is pinned where it can be, against a
 * registry a test can empty: `EntryActions/index.spec.tsx`.
 *
 * Both halves matter here. A `disabled` attribute or an `aria-disabled`
 * appearing on the primary button would be the regression; so would the button
 * quietly losing its keyboard route, which is the failure the slot's design was
 * shaped to avoid in the first place.
 */
test.describe('Entry editor publish button, with no rule on the type', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await mockContentSchema(page);
        await mockContentSchemaDetail(page);
        await mockContentEntries(page);
        await mockContentEntryWrites(page);
        // The create form's protection read. Unprotected, so the verdict is
        // "no opinion" for the reason the type has no rule — not because the
        // request failed.
        await mockNewEntryProtection(page, { protected: false });
    });

    test('carries no refusal and no description [protection:I-04]', async ({
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
