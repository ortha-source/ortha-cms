import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * How long to keep looking for the new route's heading, and how often. A
 * private route is a lazy chunk behind a `Suspense` skeleton, so the heading
 * that names it does not exist at the moment the location changes — and for the
 * first ~100ms of a cold navigation the heading still in the DOM is the one
 * belonging to the page being *left*.
 */
const POLL_INTERVAL_MS = 100;
const POLL_TIMEOUT_MS = 5_000;

/**
 * What the announcer last saw, so it can tell "the new route has rendered" from
 * "the old route is still on screen".
 *
 * Module state rather than a `useRef` on purpose: React 19's `StrictMode` mounts
 * every effect twice in development, and a ref is re-created by that remount —
 * so the deliberately silent first render would announce the landing page on the
 * second pass. One host runs per document, so a module-level value has the same
 * lifetime as the app.
 */
let lastPath: string | null = null;
let lastHeading: Element | null = null;
let lastHeadingText: string | null = null;

/**
 * The element that names the view currently rendered, and its text.
 *
 * The `<h1>` is the one label every page in the admin already has and keeps
 * accurate — unlike the document title, which most routes never set (they
 * inherit the host HTML's "Admin"). Scoped to the `<main>` landmark when the
 * layout provides one, so the shell's own chrome cannot be mistaken for the
 * page.
 */
function readHeading(): { element: Element; text: string } | null {
    const scope = document.querySelector('main') ?? document;
    // Skip a heading that belongs to a loading placeholder. A lazy route's
    // `Suspense` fallback carries its own `sr-only` <h1> ("Loading X") so the
    // page stays navigable by heading while its chunk arrives (ORT-167) — but
    // that names the *state*, not the view the user arrived at, and reading it
    // aloud announces "Loading members" in place of "Members". Every such
    // skeleton marks its root `aria-busy`, so the announcer waits past it and
    // reports the settled heading once the real page mounts.
    const element = Array.from(scope.querySelectorAll('h1')).find(
        (h1) => !h1.closest('[aria-busy="true"]')
    );
    const text = element?.textContent?.trim();
    return element && text ? { element, text } : null;
}

/**
 * Speaks the name of each new view after a client-side navigation.
 *
 * A single-page app changes the whole view without the browser navigating, and a
 * screen reader is given nothing to report: `<Routes>` swaps the matched
 * element, focus stays on the link that was activated, and the tab title is
 * unchanged. The result is that no page change in the admin is announced at all
 * — the archetypal SPA failure of WCAG `4.1.3 Status Messages`.
 *
 * This mounts one visually-hidden polite live region for the life of the app —
 * present before any message exists, which is the precondition for a live region
 * to be announced at all — and writes the new view's name into it on every
 * pathname change after the first. The first is skipped deliberately: a fresh
 * page load is a real navigation the browser already reports, and announcing it
 * again would double up.
 *
 * **It waits for the heading to actually change.** Naively reading the `<h1>` a
 * moment after the location changes announces the page the user just *left*: the
 * incoming route is a lazy chunk behind a `Suspense` skeleton, so for the first
 * frames of a cold navigation the only heading in the DOM is the outgoing one.
 * Measured on a live stack before this guard existed — `/workspaces` →
 * `/activity` announced "Workspaces" — which is worse than silence, because it
 * tells a screen-reader user they are somewhere they have just left. So the
 * announcer remembers the heading it last saw and polls until it finds a
 * *different* one (a different element, or the same element with different text,
 * which is how a page that fills its own title in asynchronously looks). If the
 * heading never changes within {@link POLL_TIMEOUT_MS} it stays quiet rather
 * than guess — the cost is that two routes sharing one heading text are not
 * announced, which is the right way round.
 *
 * It does **not** move focus. Where focus belongs is a decision only the
 * arriving page can make (identity's auth screens focus their own heading; a
 * page opening an editor may want the first field), and taking it at the host
 * would fight them. The keyboard route past the sidebar is the shell's "Skip to
 * main content" link.
 */
export function RouteAnnouncer() {
    const { pathname } = useLocation();
    const [announcement, setAnnouncement] = useState('');

    useEffect(() => {
        const initial = lastPath === null;
        // The landing page, or a re-render on the same path: nothing changed
        // that the user was not already told about. The landing page's heading
        // is still recorded, so it becomes the baseline the first real
        // navigation has to differ from.
        const samePath = lastPath === pathname;
        lastPath = pathname;

        let cancelled = false;
        let timer = 0;
        const startedAt = Date.now();

        // Cleared first so that going A → B → A announces "A" again: an
        // unchanged live region is never re-read.
        if (!initial && !samePath) setAnnouncement('');

        const tick = () => {
            if (cancelled) return;
            const heading = readHeading();
            const changed =
                heading &&
                (heading.element !== lastHeading ||
                    heading.text !== lastHeadingText);

            if (heading && (initial || samePath)) {
                // Baseline only: remember what is on screen, say nothing.
                lastHeading = heading.element;
                lastHeadingText = heading.text;
                return;
            }

            if (changed) {
                lastHeading = heading.element;
                lastHeadingText = heading.text;
                setAnnouncement(heading.text);
                return;
            }

            if (Date.now() - startedAt >= POLL_TIMEOUT_MS) return;
            timer = window.setTimeout(tick, POLL_INTERVAL_MS);
        };

        timer = window.setTimeout(tick, POLL_INTERVAL_MS);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [pathname]);

    return (
        <p
            data-testid="route-announcer"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
        >
            {announcement}
        </p>
    );
}
