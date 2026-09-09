import { test, expect } from '../support/fixtures';
import { expectNoA11yViolations } from '../support/a11y';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { LIBRARY_WORKSPACE, mockContentSchema } from '../support/api/content';
import { daysAgo, mockReviewQueue } from '../support/api/protection';

const WS = LIBRARY_WORKSPACE.id;
/** The signed-in admin `mockSignedIn` seeds by default. */
const ME = '00000000-0000-0000-0000-000000000001';
const SOMEBODY_ELSE = '00000000-0000-0000-0000-0000000000ff';

/** `/workspaces/:id/reviews`. */
const REVIEWS = `/workspaces/${WS}/reviews`;

/**
 * The reviewer's queue in a real browser.
 *
 * The page exists because until the mail port lands nothing else tells a
 * reviewer that an approval is wanted, so the questions worth asking here are
 * about **legibility**: does somebody who has not read the ADR learn that work
 * is waiting, whose it is, and how long it has sat — and does a failed read say
 * so instead of reading as an empty queue, which would tell a reviewer they are
 * free when they are not.
 */
test.describe('Review queue', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await mockContentSchema(page);
    });

    test('splits the queue into what is waiting on me and what I asked for', async ({
        page
    }) => {
        await mockReviewQueue(page, [
            { id: 'r1', requestedBy: SOMEBODY_ELSE },
            { id: 'r2', requestedBy: SOMEBODY_ELSE },
            { id: 'r3', requestedBy: ME }
        ]);
        await page.goto(REVIEWS);

        const waiting = page.getByRole('radio', { name: /waiting on me/i });
        const mine = page.getByRole('radio', { name: /my requests/i });
        await expect(waiting).toBeVisible();

        // The counts are the split, and they have to add up to the window —
        // a tab that quietly dropped a line would hide work from the only
        // page that reports it.
        await expect(waiting).toContainText('2');
        await expect(mine).toContainText('1');

        await expect(page.getByRole('row')).toHaveCount(3); // header + 2 rows

        await mine.click();
        await expect(page.getByRole('row')).toHaveCount(2); // header + 1 row
    });

    /**
     * Colour is not information. An overdue ask is warning-toned *and* says so,
     * which is the half a greyscale screen and a screen reader depend on.
     */
    test('says an overdue request is overdue, in words', async ({ page }) => {
        await mockReviewQueue(page, [
            { id: 'old', requestedBy: SOMEBODY_ELSE, createdAt: daysAgo(5) }
        ]);
        await page.goto(REVIEWS);

        await expect(page.getByText(/5 days waiting/)).toBeVisible();
        await expect(page.getByText(/overdue/)).toBeVisible();
    });

    test('does not call a recent request overdue', async ({ page }) => {
        await mockReviewQueue(page, [
            { id: 'new', requestedBy: SOMEBODY_ELSE, createdAt: daysAgo(1) }
        ]);
        await page.goto(REVIEWS);

        await expect(page.getByText(/1 day waiting/)).toBeVisible();
        await expect(page.getByText(/overdue/)).toHaveCount(0);
    });

    test('says the queue is empty when it is', async ({ page }) => {
        await mockReviewQueue(page, []);
        await page.goto(REVIEWS);

        await expect(
            page.getByText(/nothing is waiting on you/i)
        ).toBeVisible();
    });

    /**
     * ⭐ The one this page must never get wrong. "Nothing is waiting on you" is
     * a claim about the workspace; saying it when the truth is "we could not
     * ask" tells a reviewer they are free when they are not.
     */
    test('a failed read is not an empty queue', async ({ page }) => {
        // A `403`, not a `500`: the app retries 5xx three times with backoff
        // (~12s) before surfacing anything, so a 500 here would be a test of
        // the retry ladder. A settled 4xx is what the policy calls an answer,
        // and it is the realistic failure anyway — a caller whose
        // `content:read` went away mid-session.
        await mockReviewQueue(page, [], { status: 403 });
        await page.goto(REVIEWS);

        await expect(page.getByRole('alert')).toContainText(
            /could not be loaded/i
        );
        await expect(page.getByText(/nothing is waiting on you/i)).toHaveCount(
            0
        );
    });

    test('the tab strip is operable from the keyboard', async ({ page }) => {
        await mockReviewQueue(page, [
            { id: 'r1', requestedBy: SOMEBODY_ELSE },
            { id: 'r2', requestedBy: ME }
        ]);
        await page.goto(REVIEWS);

        const waiting = page.getByRole('radio', { name: /waiting on me/i });
        await waiting.focus();
        await expect(waiting).toBeFocused();

        // Radix `ToggleGroup` gives arrow-key navigation and radiogroup
        // semantics, which is what makes this a tab strip rather than two
        // styled links.
        await page.keyboard.press('ArrowRight');
        await expect(
            page.getByRole('radio', { name: /my requests/i })
        ).toBeFocused();
    });

    /**
     * The suite navigates by URL, so without this nothing would prove the page
     * is *reachable*. That is the failure this harness warns about by name: a
     * permission-gated contribution whose key is missing renders for nobody
     * while every spec still reports green, and it has shipped that way four
     * times.
     */
    test('is reachable from the workspace nav', async ({ page }) => {
        await mockReviewQueue(page, []);
        await page.goto(`/workspaces/${WS}/content`);

        const link = page.getByRole('link', { name: /^reviews$/i });
        await expect(link).toBeVisible();

        await link.click();
        await expect(
            page.getByRole('heading', { name: 'Reviews', exact: true })
        ).toBeVisible();
    });

    test('has no accessibility violations', async ({ page, makeAxe }) => {
        await mockReviewQueue(page, [
            { id: 'r1', requestedBy: SOMEBODY_ELSE, createdAt: daysAgo(5) },
            { id: 'r2', requestedBy: ME }
        ]);
        await page.goto(REVIEWS);
        await expect(
            page.getByRole('heading', { name: 'Reviews', exact: true })
        ).toBeVisible();

        await expectNoA11yViolations(makeAxe());
    });
});
