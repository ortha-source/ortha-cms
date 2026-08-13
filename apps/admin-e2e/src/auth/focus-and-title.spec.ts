import { test, expect } from '../support/fixtures';
import { mockLogin, mockSignedIn, mockSignedOut } from '../support/api/auth';
import { mockInvite } from '../support/api/invites';

/**
 * Focus management and page titles on the auth screens — WCAG 2.4.3 (Focus
 * Order), 4.1.3 (Status Messages) and 2.4.2 (Page Titled).
 *
 * None of this is something axe can judge. A scan sees a heading and an
 * `role="alert"` and passes; what it cannot see is *where the user is standing*
 * after the page changed under them. These screens are reached by transitions
 * the browser never treats as navigations — the gate redirecting an expired
 * session, the invite lookup resolving — so without help focus stays on `<body>`
 * or on a control that no longer exists, and the tab title still says whatever
 * it said before.
 */
/**
 * The resolved `outline-style` of one element — `'none'` when the browser is
 * drawing no focus ring.
 *
 * Typed inline through `globalThis`: this project's tsconfig ships no DOM lib
 * (the specs drive a browser, they do not compile against one), the same reason
 * `reflow.spec.ts` reaches for `documentElement` that way. Runs in the page, so
 * it must stay self-contained.
 */
function outlineStyleOf(node: unknown): string {
    return (
        globalThis as unknown as {
            getComputedStyle: (el: unknown) => { outlineStyle: string };
        }
    ).getComputedStyle(node).outlineStyle;
}

/**
 * The resolved `box-shadow` of one element — how the design system actually
 * draws a focus indicator. Its inputs set `focus-visible:outline-none` and
 * `focus-visible:ring-2`, so "has an outline" is the wrong question to ask of a
 * control: the ring is a shadow.
 */
function boxShadowOf(node: unknown): string {
    return (
        globalThis as unknown as {
            getComputedStyle: (el: unknown) => { boxShadow: string };
        }
    ).getComputedStyle(node).boxShadow;
}

test.describe('auth focus management', () => {
    test('a failed sign-in moves focus to the error, not past it', async ({
        page,
        loginPage
    }) => {
        await mockSignedOut(page);
        await mockLogin(page, { status: 401 });
        await loginPage.goto();
        await expect(loginPage.heading).toBeVisible();

        await loginPage.login('admin@example.com', 'wrong-password');

        await expect(loginPage.errorBanner).toBeVisible();
        // Focus used to stay on the submit button, which sits *after* the banner
        // in DOM order — so Tab moved further away from the message and the only
        // way back was Shift+Tab through both fields.
        await expect(loginPage.errorBanner).toBeFocused();
    });

    test('the fields are one Tab away from the focused error', async ({
        page,
        loginPage
    }) => {
        await mockSignedOut(page);
        await mockLogin(page, { status: 401 });
        await loginPage.goto();
        await expect(loginPage.heading).toBeVisible();
        await loginPage.login('admin@example.com', 'wrong-password');
        await expect(loginPage.errorBanner).toBeFocused();

        // The point of moving focus is that correcting the mistake is now the
        // next thing you can do, rather than a hunt backwards through the form.
        await page.keyboard.press('Tab');
        await expect(loginPage.email).toBeFocused();
    });

    test('the banner is not added to the tab order', async ({
        page,
        loginPage
    }) => {
        await mockSignedOut(page);
        await loginPage.goto();
        await expect(loginPage.heading).toBeVisible();

        // With no error showing, the first Tab must still land on the email
        // field — `tabIndex={-1}` makes the banner a focus *target*, never a stop.
        await page.keyboard.press('Tab');
        await expect(loginPage.email).toBeFocused();
    });

    test('arriving at sign-in focuses its heading rather than the document body', async ({
        page,
        loginPage
    }) => {
        await mockSignedOut(page);
        await loginPage.goto();

        await expect(loginPage.heading).toBeVisible();
        await expect(loginPage.heading).toBeFocused();
    });

    test('the focused heading is not ringed like a control', async ({
        page,
        loginPage
    }) => {
        await mockSignedOut(page);
        await loginPage.goto();
        await expect(loginPage.heading).toBeVisible();
        await expect(loginPage.heading).toBeFocused();

        // Chrome treats this programmatic focus as `:focus-visible` and paints
        // its default outline, which drew a box around the page title — it read
        // as something to interact with. Suppressing it is safe *only* because
        // `tabindex="-1"` keeps the heading out of the tab order, so nobody can
        // navigate onto it and need the indicator.
        expect(await loginPage.heading.evaluate(outlineStyleOf)).toBe('none');
    });

    test('the focused error banner is not ringed either', async ({
        page,
        loginPage
    }) => {
        await mockSignedOut(page);
        await mockLogin(page, { status: 401 });
        await loginPage.goto();
        await expect(loginPage.heading).toBeVisible();
        await loginPage.login('admin@example.com', 'wrong-password');
        await expect(loginPage.errorBanner).toBeFocused();

        // A second box inside the banner's own destructive border is noise.
        expect(await loginPage.errorBanner.evaluate(outlineStyleOf)).toBe(
            'none'
        );
    });

    test('a control reached by Tab keeps its focus indicator', async ({
        page,
        loginPage
    }) => {
        await mockSignedOut(page);
        await loginPage.goto();
        await expect(loginPage.heading).toBeVisible();

        // The guard on the two tests above: suppressing the indicator on
        // non-interactive focus targets must not have leaked into anything a
        // keyboard user actually navigates to.
        //
        // Asserted on the *shadow*, not the outline: the design system's inputs
        // set `focus-visible:outline-none focus-visible:ring-2`, so they have no
        // outline by design and checking for one would fail on a control that is
        // in fact perfectly indicated.
        const unfocused = await loginPage.email.evaluate(boxShadowOf);
        await page.keyboard.press('Tab');
        await expect(loginPage.email).toBeFocused();
        expect(await loginPage.email.evaluate(boxShadowOf)).not.toBe(unfocused);
    });

    test('the invite form takes focus when the lookup resolves', async ({
        page,
        acceptInvitePage
    }) => {
        await mockSignedOut(page);
        // Held open so the skeleton renders first: the form replaces it without
        // any navigation, which is exactly the transition that used to strand
        // focus at the top of the document.
        await mockInvite(page, undefined, { delayMs: 300 });
        await acceptInvitePage.goto('tok_focus');

        await expect(acceptInvitePage.heading).toBeVisible();
        await expect(acceptInvitePage.heading).toBeFocused();
    });

    test('the dead-link card takes focus when the lookup fails', async ({
        page,
        acceptInvitePage
    }) => {
        await mockSignedOut(page);
        await mockInvite(page, undefined, { status: 404, delayMs: 300 });
        await acceptInvitePage.goto('tok_dead');

        await expect(acceptInvitePage.unavailableHeading()).toBeVisible();
        await expect(acceptInvitePage.unavailableHeading()).toBeFocused();
    });
});

test.describe('auth page titles', () => {
    test('the sign-in page names itself in the tab title', async ({
        page,
        loginPage
    }) => {
        await mockSignedOut(page);
        await loginPage.goto();
        await expect(loginPage.heading).toBeVisible();

        await expect(page).toHaveTitle(/Sign in/);
    });

    test('the accept-invite page names itself in the tab title', async ({
        page,
        acceptInvitePage
    }) => {
        await mockSignedOut(page);
        await mockInvite(page);
        await acceptInvitePage.goto('tok_title');
        await expect(acceptInvitePage.heading).toBeVisible();

        await expect(page).toHaveTitle(/Accept your invite/);
    });

    test('signing in hands the title back instead of stranding "Sign in" over the app', async ({
        page,
        loginPage,
        homePage
    }) => {
        await mockSignedOut(page);
        await mockLogin(page, { status: 201 });
        await loginPage.goto();
        await expect(page).toHaveTitle(/Sign in/);

        await mockSignedIn(page);
        await loginPage.login('admin@example.com', 'SecurePass123!');
        await expect(homePage.heading).toBeVisible();

        // The auth title is scoped to the auth screens; restoring it on unmount
        // is what lets this plugin set a title without owning every route.
        await expect(page).not.toHaveTitle(/Sign in/);
    });
});
