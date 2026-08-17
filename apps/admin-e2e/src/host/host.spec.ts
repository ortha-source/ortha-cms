import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockMembers } from '../support/api/members';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockApiTokensApi } from '../support/api/apiTokens';

/**
 * What `@ortha-cms/bootstrap-admin` mounts for itself.
 *
 * Every admin plugin renders through this host, so its defects are whole-app
 * shaped — and until now nothing exercised it directly: the routing suites go
 * through it on the way to a feature, which proves the happy path assembles but
 * says nothing about what happens when a plugin misbehaves. These are the host's
 * own guarantees: that one broken route cannot take the product with it, that a
 * client-side navigation is reported to a screen reader, that the toast corner
 * is where the rest of the app believes it is, and that the keyboard route past
 * the sidebar works.
 */

test.describe('a private route whose chunk never loads', () => {
    test('shows a recoverable card instead of blanking the app', async ({
        page,
        hostPage,
        membersPage
    }) => {
        await mockSignedIn(page);
        await mockMembers(page);
        await hostPage.breakChunk('MembersPage');

        await membersPage.goto();

        await expect(hostPage.crashHeading).toBeVisible({ timeout: 15_000 });
        await expect(hostPage.crashReload).toBeVisible();
        // The regression this guards: a throw reaching the root unmounts the
        // whole tree, and `#root` is left with zero children — a blank page with
        // nothing to focus, no sidebar to leave by, and no hint that reloading
        // is the fix.
        expect(await hostPage.rootChildCount()).toBeGreaterThan(0);
    });

    test('the failure is a focused heading, not bare text', async ({
        page,
        hostPage,
        membersPage
    }) => {
        await mockSignedIn(page);
        await mockMembers(page);
        await hostPage.breakChunk('MembersPage');

        await membersPage.goto();

        await expect(hostPage.crashHeading).toBeVisible({ timeout: 15_000 });
        // The content the user was reading vanished with no navigation the
        // browser reports. Without moving focus, a keyboard user resumes from
        // `<body>` and a screen reader keeps reading a buffer of content that no
        // longer exists.
        await expect(hostPage.crashHeading).toBeFocused();
    });

    test('a broken page does not take the toast host with it', async ({
        page,
        hostPage,
        membersPage
    }) => {
        await mockSignedIn(page);
        await mockMembers(page);
        await hostPage.breakChunk('MembersPage');

        await membersPage.goto();
        await expect(hostPage.crashHeading).toBeVisible({ timeout: 15_000 });

        // Sonner's live region is mounted outside the boundary on purpose: a
        // toast is how the rest of the app reports trouble, so it has to outlive
        // the failure the boundary caught.
        await expect(
            page.getByRole('region', { name: /Notifications/ })
        ).toBeAttached();
    });
});

test.describe('client-side navigation is announced', () => {
    test('the live region is mounted, and empty, before anything happens', async ({
        page,
        hostPage,
        homePage
    }) => {
        await mockSignedIn(page);
        await homePage.goto();
        await expect(homePage.heading).toBeVisible();

        // A live region only announces content added *after* it is in the DOM,
        // so it has to exist from first paint…
        await expect(hostPage.routeAnnouncer).toBeAttached();
        await expect(hostPage.routeAnnouncer).toHaveAttribute(
            'aria-live',
            'polite'
        );
        // …and it must say nothing about the landing page, which the browser's
        // own navigation already reported.
        await expect(hostPage.routeAnnouncer).toHaveText('');
    });

    test('moving to another page speaks that page name', async ({
        page,
        hostPage,
        homePage,
        membersPage
    }) => {
        await mockSignedIn(page);
        await mockMembers(page);
        await homePage.goto();
        await expect(homePage.nav).toBeVisible();

        await homePage.nav.getByRole('link', { name: 'Members' }).click();

        await expect(membersPage.heading).toBeVisible();
        // Without this the navigation is silent in every channel at once: focus
        // stays on the nav link, the tab title never changes, and `<Routes>`
        // swaps the view with nothing to report — the archetypal SPA failure of
        // WCAG 4.1.3.
        await expect(hostPage.routeAnnouncer).toHaveText('Members');
    });

    test('a second navigation names the new page, not the one just left', async ({
        page,
        hostPage,
        homePage,
        membersPage,
        workspacesPage
    }) => {
        await mockSignedIn(page);
        await mockMembers(page);
        await mockWorkspaces(page);
        await homePage.goto();
        await expect(homePage.nav).toBeVisible();

        await homePage.nav.getByRole('link', { name: 'Members' }).click();
        await expect(membersPage.heading).toBeVisible();
        await expect(hostPage.routeAnnouncer).toHaveText('Members');

        // The regression: the incoming route is a lazy chunk behind a skeleton,
        // so for the first frames of a cold navigation the only `<h1>` in the DOM
        // still belongs to the page being left. Reading it announced "Members"
        // on arrival at Workspaces — telling a screen-reader user they are
        // somewhere they have just left, which is worse than saying nothing.
        await homePage.nav.getByRole('link', { name: 'Workspaces' }).click();
        await expect(workspacesPage.heading).toBeVisible();

        await expect(hostPage.routeAnnouncer).toHaveText('Workspaces');
    });

    test('returning to a page announces it again', async ({
        page,
        hostPage,
        homePage,
        membersPage,
        workspacesPage
    }) => {
        await mockSignedIn(page);
        await mockMembers(page);
        await mockWorkspaces(page);
        await homePage.goto();
        await expect(homePage.nav).toBeVisible();

        await homePage.nav.getByRole('link', { name: 'Members' }).click();
        await expect(membersPage.heading).toBeVisible();
        await expect(hostPage.routeAnnouncer).toHaveText('Members');

        await homePage.nav.getByRole('link', { name: 'Workspaces' }).click();
        await expect(workspacesPage.heading).toBeVisible();
        await expect(hostPage.routeAnnouncer).toHaveText('Workspaces');

        // Coming back is a change of view too, so the region has to be cleared
        // and rewritten — an unchanged live region is never re-read.
        await homePage.nav.getByRole('link', { name: 'Members' }).click();
        await expect(membersPage.heading).toBeVisible();
        await expect(hostPage.routeAnnouncer).toHaveText('Members');
    });

    test('the announcement takes up no space on screen', async ({
        page,
        hostPage,
        homePage
    }) => {
        await mockSignedIn(page);
        await mockMembers(page);
        await homePage.goto();
        await expect(homePage.nav).toBeVisible();

        await homePage.nav.getByRole('link', { name: 'Members' }).click();
        await expect(hostPage.routeAnnouncer).toHaveText('Members');

        // It exists for assistive technology only; a visible copy of the page
        // name would be a second, wrong heading on every route. Asserted on the
        // box rather than with `not.toBeVisible()`: `sr-only` deliberately keeps
        // the element rendered and 1px, which Playwright (rightly) calls visible
        // — hiding it any harder would take it out of the accessibility tree and
        // silence the announcement.
        const box = await hostPage.routeAnnouncer.boundingBox();
        expect(box?.width ?? 0).toBeLessThanOrEqual(1);
        expect(box?.height ?? 0).toBeLessThanOrEqual(1);
    });
});

test.describe('the toast host', () => {
    test('sits in the corner the design system documents', async ({
        page,
        hostPage,
        apiTokensPage
    }) => {
        await mockSignedIn(page);
        await mockApiTokensApi(page);
        await apiTokensPage.goto();
        await apiTokensPage.table.waitFor();

        await apiTokensPage.chooseRevoke('Production website');
        await apiTokensPage.confirmRevokeButton().click();
        await expect(apiTokensPage.toast('Token revoked')).toBeVisible();

        // The corner used to be declared twice and disagree — the design system
        // documented top-right, the host passed `position="bottom-right"`, and
        // the spread order decided it. It is now stated once, and `copilot-admin`
        // reasons about the answer (it suppresses a toast while its bottom-right
        // dock is open), so a silent drift would break something two packages
        // away.
        await expect(hostPage.toastHost).toHaveAttribute(
            'data-y-position',
            'bottom'
        );
        await expect(hostPage.toastHost).toHaveAttribute(
            'data-x-position',
            'right'
        );
    });
});

test.describe('bypass blocks', () => {
    test('the first Tab reaches a visible skip link', async ({
        page,
        hostPage,
        homePage
    }) => {
        await mockSignedIn(page);
        await homePage.goto();
        await expect(homePage.nav).toBeVisible();

        await page.keyboard.press('Tab');

        // Visually hidden until focused, so "visible" is itself the assertion:
        // a bypass a sighted keyboard user cannot see is not one (WCAG 2.4.1).
        await expect(hostPage.skipLink).toBeFocused();
        await expect(hostPage.skipLink).toBeVisible();
    });

    test('activating it puts focus inside main, past the sidebar', async ({
        page,
        hostPage,
        homePage
    }) => {
        await mockSignedIn(page);
        await homePage.goto();
        await expect(homePage.nav).toBeVisible();

        await page.keyboard.press('Tab');
        await expect(hostPage.skipLink).toBeFocused();
        await page.keyboard.press('Enter');

        // The whole point is the focus move, not the scroll: `<main>` carries
        // `tabIndex={-1}` precisely so the fragment can land on it. A skip link
        // that only changes the hash leaves the next Tab back at the top of the
        // sidebar — the block it was supposed to bypass.
        await expect(hostPage.main).toBeFocused();
    });
});
