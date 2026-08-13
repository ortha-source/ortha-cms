import { test, expect } from '../support/fixtures';
import { mockSignedOut } from '../support/api/auth';
import { mockInvite } from '../support/api/invites';

/**
 * `prefers-reduced-motion` on the auth screens — WCAG 2.3.3 (Animation from
 * Interactions) and, for a shipped product, Section 508 §503.2 (an application
 * must not override a user's platform preferences).
 *
 * The loading skeleton is the only thing that animates here, and it is the worst
 * candidate for an unconditional one: it is decorative (the `role="status"`
 * region is what actually says "busy"), and it loops for as long as the request
 * takes, so on a slow connection a motion-sensitive user watches it pulse
 * indefinitely. axe cannot judge this — it never emulates the media query — so
 * the guard has to be a real one.
 */

/**
 * The resolved `animation-name` of one element — `'none'` when nothing is
 * running.
 *
 * Typed inline through `globalThis`: this project's tsconfig ships no DOM lib
 * (the specs drive a browser, they do not compile against one), the same reason
 * `reflow.spec.ts` reaches for `documentElement` that way. Runs in the page, so
 * it must stay self-contained — no closure over anything in this file.
 */
function animationNameOf(node: unknown): string {
    return (
        globalThis as unknown as {
            getComputedStyle: (el: unknown) => { animationName: string };
        }
    ).getComputedStyle(node).animationName;
}
test.describe('reduced motion', () => {
    test('the busy skeleton does not pulse when reduced motion is requested', async ({
        page,
        acceptInvitePage
    }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await mockSignedOut(page);
        // Held open so the skeleton is on screen long enough to inspect.
        await mockInvite(page, undefined, { delayMs: 3000 });
        await acceptInvitePage.goto('tok_reduced_motion');

        await expect(acceptInvitePage.loadingStatus()).toBeVisible();
        const block = acceptInvitePage.skeletonBlocks().first();
        await expect(block).toBeVisible();

        // `animation-name: none` is what `motion-reduce:animate-none` resolves
        // to; asserting the computed value rather than the class keeps this
        // honest if the utility is ever renamed.
        const animationName = await block.evaluate(animationNameOf);
        expect(animationName).toBe('none');
    });

    test('the skeleton still animates by default', async ({
        page,
        acceptInvitePage
    }) => {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await mockSignedOut(page);
        await mockInvite(page, undefined, { delayMs: 3000 });
        await acceptInvitePage.goto('tok_default_motion');

        await expect(acceptInvitePage.loadingStatus()).toBeVisible();
        const block = acceptInvitePage.skeletonBlocks().first();
        await expect(block).toBeVisible();

        // The paired assertion matters: without it, a skeleton that stopped
        // animating for an unrelated reason would make the test above pass for
        // the wrong reason.
        const animationName = await block.evaluate(animationNameOf);
        expect(animationName).not.toBe('none');
    });
});
