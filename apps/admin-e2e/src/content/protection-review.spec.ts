import { test, expect } from '../support/fixtures';
import { expectNoA11yViolations } from '../support/a11y';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    LIBRARY_WORKSPACE,
    mockContentSchema,
    mockContentSchemaDetail,
    mockContentEntries,
    mockContentEntryWrites,
    mockEntryRelations
} from '../support/api/content';
import { UNPROTECTED, mockEntryReview } from '../support/api/protection';

const WS = LIBRARY_WORKSPACE.id;
const TYPE = 'blog_post';
/** The first row of the fabricated page — the record whose editor is opened. */
const ENTRY = 'blog_post-01';

/**
 * Publication protection **inside the entry editor** — the three surfaces an
 * editor actually meets it through, in a real browser.
 *
 * The server side is covered by `server-e2e`; what only a browser can answer is
 * whether the requirement is *legible*: whether a person who has not read the
 * ADR can tell why Publish will not go, and whether the count rolling back
 * after a save explains itself instead of just changing.
 */
test.describe('Publication protection in the entry editor', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await mockContentSchema(page);
        await mockContentSchemaDetail(page);
        await mockContentEntries(page);
        await mockContentEntryWrites(page);
        await mockEntryRelations(page);
    });

    /**
     * The state every installation is in until somebody writes a rule, and the
     * one this plugin spends almost all of its life in. Nothing may appear.
     */
    test('says nothing at all on an unprotected type', async ({
        page,
        contentLibraryPage
    }) => {
        await mockEntryReview(page, UNPROTECTED);
        await contentLibraryPage.gotoEntry(WS, TYPE, ENTRY);

        await expect(page.getByText(/needs review/i)).toHaveCount(0);
        await expect(
            page.getByRole('heading', { name: 'Review', exact: true })
        ).toHaveCount(0);
        const publish = page.getByRole('button', { name: /^publish$/i });
        await expect(publish).toBeVisible();
        await expect(publish).not.toHaveAttribute('aria-disabled', 'true');
    });

    test('shows the requirement in the chip and the rail', async ({
        page,
        contentLibraryPage
    }) => {
        await mockEntryReview(page, { required: 2, given: 0 });
        await contentLibraryPage.gotoEntry(WS, TYPE, ENTRY);

        await expect(page.getByText('Needs review · 0 of 2')).toBeVisible();
        await expect(
            page.getByRole('heading', { name: 'Review', exact: true })
        ).toBeVisible();
        await expect(page.getByText('0 of 2', { exact: true })).toBeVisible();
    });

    /**
     * ⭐ The line the whole feature turns on. The strike-through is decoration;
     * the sentence beside it is the fact, and it must be real text on the page.
     */
    test('explains a stale approval in words, not only in decoration', async ({
        page,
        contentLibraryPage
    }) => {
        await mockEntryReview(page, {
            required: 2,
            given: 1,
            stale: 1,
            approvals: [
                { userId: 'u-anna', decision: 'approved', revisionNumber: 7 },
                {
                    userId: 'u-dmitry',
                    decision: 'approved',
                    revisionNumber: 4,
                    revisionId: 'rev-4',
                    isStale: true
                }
            ]
        });
        await contentLibraryPage.gotoEntry(WS, TYPE, ENTRY);

        await expect(page.getByText(/approved version 7/)).toBeVisible();
        await expect(
            page.getByText(
                /approved version 4 .* the entry has changed since, so this no longer counts/
            )
        ).toBeVisible();
    });

    test('holds the publish button and says how far short it is', async ({
        page,
        contentLibraryPage
    }) => {
        await mockEntryReview(page, { required: 2, given: 0, blocked: true });
        await contentLibraryPage.gotoEntry(WS, TYPE, ENTRY);

        const publish = page.getByRole('button', { name: /^publish$/i });
        await expect(publish).toHaveAttribute('aria-disabled', 'true');
        // The reason reaches a screen reader as the button's *description*.
        await expect(
            page.getByText('2 approvals required on this version, 0 given.')
        ).toBeAttached();
    });

    test('offers an administrator a differently-worded button', async ({
        page,
        contentLibraryPage
    }) => {
        await mockEntryReview(page, {
            required: 2,
            given: 0,
            blocked: true,
            bypassable: true
        });
        await contentLibraryPage.gotoEntry(WS, TYPE, ENTRY);

        await expect(
            page.getByRole('button', { name: /publish anyway/i })
        ).toBeVisible();
        // A bypass must never be spelled like an ordinary publish.
        await expect(
            page.getByRole('button', { name: /^publish$/i })
        ).toHaveCount(0);
    });

    /**
     * ⭐ The refusal a person can hear. The confirm stays operable — a disabled
     * control announces nothing — so an empty reason must be answered, not
     * ignored.
     */
    test('refuses a bypass with no reason, out loud', async ({
        page,
        contentLibraryPage
    }) => {
        await mockEntryReview(page, {
            required: 2,
            given: 0,
            blocked: true,
            bypassable: true
        });
        await contentLibraryPage.gotoEntry(WS, TYPE, ENTRY);

        await page.getByRole('button', { name: /publish anyway/i }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText(/entry\.publish_bypassed/)).toBeVisible();

        const confirm = dialog.getByRole('button', {
            name: /publish anyway/i
        });
        await expect(confirm).toBeEnabled();
        await confirm.click();

        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole('alert')).toContainText(
            /reason is required/i
        );
    });

    test('returns focus to the trigger when the dialog closes', async ({
        page,
        contentLibraryPage
    }) => {
        await mockEntryReview(page, {
            required: 2,
            given: 0,
            blocked: true,
            bypassable: true
        });
        await contentLibraryPage.gotoEntry(WS, TYPE, ENTRY);

        const trigger = page.getByRole('button', { name: /publish anyway/i });
        await trigger.click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(trigger).toBeFocused();
    });

    test('has no accessibility violations with a rule in force', async ({
        page,
        contentLibraryPage,
        makeAxe
    }) => {
        await mockEntryReview(page, {
            required: 2,
            given: 1,
            stale: 1,
            bypassable: true,
            approvals: [
                { userId: 'u-anna', decision: 'approved', revisionNumber: 7 },
                {
                    userId: 'u-dmitry',
                    decision: 'approved',
                    revisionNumber: 4,
                    isStale: true
                }
            ]
        });
        await contentLibraryPage.gotoEntry(WS, TYPE, ENTRY);
        await expect(
            page.getByRole('heading', { name: 'Review', exact: true })
        ).toBeVisible();

        await expectNoA11yViolations(makeAxe());
    });
});
