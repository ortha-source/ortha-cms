import { useEffect } from 'react';

/**
 * Sets `document.title` while the calling component is mounted, restoring
 * whatever it was on the way out.
 *
 * The auth screens are the one place in the admin where the tab title is the
 * only signal of where you are: they render outside the app shell, and a
 * session that expires mid-visit swaps the page under you with no navigation a
 * screen reader would report. WCAG 2.4.2 wants the title to describe the page,
 * and with a single static title ("Admin") the app, the sign-in page and the
 * accept-invite page were indistinguishable in the tab strip, in the window
 * list, and in a screen reader's window announcement.
 *
 * Restoring on unmount rather than leaving the last value behind is what makes
 * this safe to use on a subset of routes: signing in returns the title to the
 * host's, instead of stranding "Sign in" over the app for the rest of the
 * session.
 *
 * **One owner at a time.** `copilot-admin`'s `useTabBadge` snapshots
 * `document.title` when it mounts and restores that snapshot on unmount, so two
 * writers overlapping would fight. They cannot overlap today — the badge lives
 * inside the shell and these screens render outside it — but a future title
 * hook mounted within the shell has to reckon with that, not just call this.
 */
export function useDocumentTitle(title: string): void {
    useEffect(() => {
        const previous = document.title;
        document.title = title;

        return () => {
            document.title = previous;
        };
    }, [title]);
}
