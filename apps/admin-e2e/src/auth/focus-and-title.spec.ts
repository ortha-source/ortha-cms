import { test, expect } from '../support/fixtures';
import {
    mockLogin,
    mockSignedIn,
    mockSignedOut,
    mockUnauthorized
} from '../support/api/auth';
import { mockInvite } from '../support/api/invites';
import { mockMembers } from '../support/api/members';

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

/**
 * The top edge of a rendered element, in page coordinates — how "comes before"
 * is judged here. Structurally typed rather than imported as a `Locator`, and
 * it throws rather than returning `null`, so an element that is not on screen
 * fails as a missing element instead of comparing as `0`.
 */
async function topOf(locator: {
    boundingBox(): Promise<{ y: number } | null>;
}): Promise<number> {
    const box = await locator.boundingBox();
    if (!box) {
        throw new Error('expected the element to be rendered on screen');
    }
    return box.y;
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

    test('a second, different failure takes focus again', async ({
        page,
        loginPage
    }) => {
        // The banner focuses on mount **and** whenever its message changes, and
        // the second half is the one that is easy to lose. Between two attempts
        // the mutation clears its error, so the usual case unmounts the banner
        // and the next one is a fresh mount — but a rendering that kept the node
        // alive (a banner mounted with an empty message, say) would swap the
        // text in place and never fire the effect, leaving the user standing
        // wherever they were while the page silently said something new.
        await mockSignedOut(page);
        await mockLogin(page, { status: 401 });
        await loginPage.goto();
        await expect(loginPage.heading).toBeVisible();

        await loginPage.login('admin@example.com', 'wrong-password');
        await expect(loginPage.errorBanner).toBeFocused();
        await expect(loginPage.errorBanner).toContainText(
            'email or password you entered is incorrect'
        );

        // Move focus away, exactly as somebody correcting the form would, then
        // fail differently: a `500` maps to the generic message, so the banner
        // has new text to announce.
        await loginPage.email.focus();
        await expect(loginPage.email).toBeFocused();
        await mockLogin(page, { status: 500 });
        await loginPage.submit.click();

        await expect(loginPage.errorBanner).toContainText(
            'Something went wrong'
        );
        await expect(loginPage.errorBanner).toBeFocused();
    });

    test('the session-lost notice does not take focus away from the heading', async ({
        page,
        loginPage,
        membersPage
    }) => {
        // The other alert on this card, and it must behave the opposite way.
        // `AuthLayout` puts focus on the `<h1>` when the screen is reached, and
        // a reader continuing from there meets the explanation next in DOM
        // order. A second focus move on the same mount would fight that — and
        // would lose the race anyway, since a child's effect runs before its
        // parent's, so the notice would be skipped past rather than read.
        await mockSignedIn(page);
        await mockMembers(page);
        await membersPage.goto();
        await expect(membersPage.heading).toBeVisible();

        await mockUnauthorized(page, '**/api/users?*');
        await membersPage.search.fill('ada');

        await expect(loginPage.sessionEndedNotice).toBeVisible();
        await expect(loginPage.heading).toBeFocused();
        await expect(loginPage.sessionEndedNotice).not.toBeFocused();
    });

    test('the notice sits between the heading and the fields', async ({
        page,
        loginPage,
        membersPage
    }) => {
        // Not focusing it is only half the claim: it has to be somewhere the
        // reader actually reaches from the heading they were placed on, and
        // before the form they are being asked to fill in again.
        await mockSignedIn(page);
        await mockMembers(page);
        await membersPage.goto();
        await expect(membersPage.heading).toBeVisible();

        await mockUnauthorized(page, '**/api/users?*');
        await membersPage.search.fill('ada');
        await expect(loginPage.sessionEndedNotice).toBeVisible();

        const heading = await topOf(loginPage.heading);
        const notice = await topOf(loginPage.sessionEndedNotice);
        const email = await topOf(loginPage.email);

        expect(notice).toBeGreaterThan(heading);
        expect(notice).toBeLessThan(email);
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
