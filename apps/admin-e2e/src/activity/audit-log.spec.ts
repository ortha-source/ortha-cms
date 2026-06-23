import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockActivity } from '../support/api/activity';
import { expectNoA11yViolations } from '../support/a11y';

/**
 * The Activity Log page (`/activity`, `@ortha-cms/activity-admin`): rendering
 * the audit trail, expandable rows revealing details, the filter toolbar
 * driving the `/api/activity` mock, the "System" actor rendering, and the
 * `activity:read` gate (no nav entry, a no-access state for users who lack it).
 * The backend is the `GET /api/activity` mock; `mockSignedIn` satisfies the
 * shell's auth probe.
 */
test.describe('Activity Log page', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockActivity(page);
    });

    test('renders the audit trail with actors and actions', async ({
        activityLogPage
    }) => {
        await activityLogPage.goto();
        await expect(activityLogPage.heading).toBeVisible();
        // The gated shell wrapped the page.
        await expect(activityLogPage.nav).toBeVisible();
        await expect(activityLogPage.table).toBeVisible();

        await expect(activityLogPage.row('Changed role')).toBeVisible();
        // An actor email shows in its row.
        await expect(
            activityLogPage.row('ada@ortha.dev').first()
        ).toBeVisible();
    });

    test('renders a system-initiated event with a "System" actor', async ({
        activityLogPage
    }) => {
        await activityLogPage.goto();
        await expect(
            activityLogPage.row('Invited member').filter({ hasText: 'System' })
        ).toBeVisible();
    });

    test('expands a row to reveal its details, then collapses it', async ({
        activityLogPage,
        page
    }) => {
        await activityLogPage.goto();
        const detail = page.getByText('viewer → contributor');

        // Collapsed by default — the detail panel isn't visible.
        await expect(detail).toBeHidden();

        await activityLogPage.expandRow('Changed role');
        await expect(detail).toBeVisible();
        await expect(
            activityLogPage.expandToggle('Changed role')
        ).toHaveAttribute('aria-expanded', 'true');

        // Toggling again collapses it: the disclosure reports collapsed and the
        // panel is marked inert. (The detail text keeps a clipped layout box
        // after the grid-rows close animation, so assert the semantic collapsed
        // state rather than the text node's geometric visibility.)
        await activityLogPage.expandRow('Changed role');
        await expect(
            activityLogPage.expandToggle('Changed role')
        ).toHaveAttribute('aria-expanded', 'false');
    });

    test('expands a row by clicking anywhere on the row body', async ({
        activityLogPage,
        page
    }) => {
        await activityLogPage.goto();
        const detail = page.getByText('viewer → contributor');
        await expect(detail).toBeHidden();

        await activityLogPage.clickRowBody('Changed role');
        await expect(detail).toBeVisible();
    });

    test('the actor-email search drives the request', async ({
        activityLogPage
    }) => {
        await activityLogPage.goto();
        await activityLogPage.emailSearch.fill('grace');

        // Only Grace's suspension event matches the actor-email filter.
        await expect(
            activityLogPage.row('grace@ortha.dev').first()
        ).toBeVisible();
        await expect(activityLogPage.row('ada@ortha.dev')).toHaveCount(0);
    });

    test('deep-links the active search into the URL', async ({
        activityLogPage,
        page
    }) => {
        await activityLogPage.goto();
        await activityLogPage.emailSearch.fill('grace');

        await expect(page).toHaveURL(/actorEmail=grace/);
    });

    test('shows an empty state when filters match nothing', async ({
        activityLogPage
    }) => {
        await activityLogPage.goto();
        await activityLogPage.emailSearch.fill('nobody-xyz');

        await expect(
            activityLogPage.emptyText('No activity matches')
        ).toBeVisible();
    });

    test('hides the nav entry and shows no-access without activity:read', async ({
        activityLogPage,
        page
    }) => {
        await mockSignedIn(page, {
            permissions: ['workspaces:read', 'users:read']
        });
        await activityLogPage.goto();

        await expect(activityLogPage.noAccessText()).toBeVisible();
        // The permission-gated nav entry is hidden.
        await expect(activityLogPage.navButton).toHaveCount(0);
    });
});

/**
 * Accessibility scans (axe, WCAG 2.1 A/AA) of the Activity Log and its states.
 * A regression guard, not a conformance claim.
 */
test.describe('Activity Log accessibility (axe, WCAG 2.1 A/AA)', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockActivity(page);
    });

    test('table — initial', async ({ activityLogPage, makeAxe }) => {
        await activityLogPage.goto();
        await activityLogPage.heading.waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('table — expanded row', async ({ activityLogPage, makeAxe, page }) => {
        await activityLogPage.goto();
        await activityLogPage.expandRow('Changed role');
        await page.getByText('viewer → contributor').waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('table — loading skeleton', async ({
        activityLogPage,
        page,
        makeAxe
    }) => {
        await mockActivity(page, undefined, { delayMs: 30_000 });
        await activityLogPage.goto();
        await activityLogPage.tableSkeleton().waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('empty state — no matches', async ({ activityLogPage, makeAxe }) => {
        await activityLogPage.goto();
        await activityLogPage.emailSearch.fill('nobody-xyz');
        await activityLogPage.emptyText('No activity matches').waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('no-access state', async ({ activityLogPage, makeAxe, page }) => {
        await mockSignedIn(page, { permissions: [] });
        await activityLogPage.goto();
        await activityLogPage.noAccessText().waitFor();
        await expectNoA11yViolations(makeAxe());
    });
});

/**
 * Keyboard operability for the Activity Log — what axe can't assert: the
 * filters take focus and filter as you type, and a row expands from the
 * keyboard.
 */
test.describe('Activity Log keyboard operability', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockActivity(page);
    });

    test('the actor-email search filters as you type', async ({
        activityLogPage
    }) => {
        await activityLogPage.goto();
        await activityLogPage.emailSearch.focus();
        await activityLogPage.emailSearch.pressSequentially('grace');

        await expect(
            activityLogPage.row('grace@ortha.dev').first()
        ).toBeVisible();
        await expect(activityLogPage.row('ada@ortha.dev')).toHaveCount(0);
    });

    test('a row expands from the keyboard', async ({
        activityLogPage,
        page
    }) => {
        await activityLogPage.goto();
        await activityLogPage.expandToggle('Changed role').focus();
        await page.keyboard.press('Enter');
        await expect(page.getByText('viewer → contributor')).toBeVisible();
    });
});
