import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * How long to keep looking for the new route's heading, and how often. A
 * private route is a lazy chunk behind a `Suspense` skeleton, so the heading
 * that names it does not exist at the moment the location changes — announcing
 * immediately would read the skeleton, or nothing at all.
 */
const POLL_INTERVAL_MS = 100;
const POLL_TIMEOUT_MS = 5_000;

/**
 * The last path this announcer spoke for, `null` until it has seen one.
 *
 * Module state rather than a `useRef` on purpose: React 19's `StrictMode` mounts
 * every effect twice in development, and a ref is re-created by that remount —
 * so the deliberately silent first render would announce the landing page on the
 * second pass. One host runs per document, so a module-level value is the same
 * lifetime as the app.
 */
let lastAnnouncedPath: string | null = null;

/**
 * The name of the view currently rendered, read from the DOM.
 *
 * The `<h1>` is the one label every page in the admin already has and keeps
 * accurate — unlike the document title, which most routes never set (they
 * inherit the host HTML's "Admin"). Scoped to the `<main>` landmark when the
 * layout provides one, so the shell's own chrome cannot be mistaken for the
 * page.
 */
function readPageName(): string | null {
    const scope = document.querySelector('main') ?? document;
    const heading = scope.querySelector('h1');
    const text = heading?.textContent?.trim();
    return text ? text : null;
}

/**
 * Speaks the name of each new view after a client-side navigation.
 *
 * A single-page app changes the whole view without the browser navigating, and
 * a screen reader is given nothing to report: `<Routes>` swaps the matched
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
 * It does **not** move focus. Where focus should land is a decision only the
 * arriving page can make (identity's auth screens focus their own heading; a
 * page opening an editor may want the first field), and taking it at the host
 * would fight them. The keyboard route past the sidebar is the shell's "Skip to
 * main content" link.
 */
export function RouteAnnouncer() {
    const { pathname } = useLocation();
    const [announcement, setAnnouncement] = useState('');

    useEffect(() => {
        // The landing page, or a re-render on the same path: nothing changed
        // that the user was not already told about.
        if (lastAnnouncedPath === null || lastAnnouncedPath === pathname) {
            lastAnnouncedPath = pathname;
            return;
        }
        lastAnnouncedPath = pathname;

        let cancelled = false;
        let timer = 0;
        const startedAt = Date.now();

        // Cleared first so that arriving at two views with the same heading
        // still changes the region's content — an unchanged live region is
        // never re-read.
        setAnnouncement('');

        const tick = () => {
            if (cancelled) return;
            const name = readPageName();
            if (name) {
                setAnnouncement(name);
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
