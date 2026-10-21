import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { Router } from 'react-router-dom';
import {
    createBrowserHistory,
    type Action,
    type BrowserHistory,
    type Location
} from '@remix-run/router';

/** The document flag `styles.css` names the work area under. */
const FLAG = 'data-ds-page-transition';

type RouterState = { action: Action; location: Location };

type ViewTransitionLike = {
    ready: Promise<void>;
    updateCallbackDone: Promise<void>;
    finished: Promise<void>;
    skipTransition: () => void;
};

type DocumentWithTransitions = Document & {
    startViewTransition?: (update: () => void) => ViewTransitionLike;
};

/**
 * Whether moving from `from` to `to` is a change of **page** — worth a
 * cross-fade — rather than a change *within* one.
 *
 * Same path (a search param, a hash): never. Two leaves under the same parent
 * at depth two or more (`/users/1/profile` → `/users/1/sessions`, one tab to
 * the next; `/…/post/1` → `/…/post/2`, one record to the next): no — the page
 * around them is the same, and fading it reads as the whole screen blinking
 * for a tab change. Anything else, including one top-level section to another
 * (`/users` → `/webhooks`): yes.
 */
export function isPageChange(from: string, to: string): boolean {
    if (from === to) return false;
    const a = from.split('/').filter(Boolean);
    const b = to.split('/').filter(Boolean);
    if (a.length !== b.length || a.length < 2) return true;
    return a.slice(0, -1).join('/') !== b.slice(0, -1).join('/');
}

/**
 * Run `update` inside a View Transition over the work area, or just run it.
 *
 * Plain when the browser has no View Transitions, when the reader asked for
 * reduced motion (the cross-fade is decoration), or when the tab is hidden
 * (a snapshot of a page nobody is looking at is wasted work).
 */
function crossFade(update: () => void, active: { current: unknown }) {
    const doc = document as DocumentWithTransitions;
    if (
        typeof doc.startViewTransition !== 'function' ||
        doc.visibilityState !== 'visible' ||
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
        update();
        return;
    }

    const root = doc.documentElement;
    root.setAttribute(FLAG, '');
    const transition = doc.startViewTransition(update);
    active.current = transition;
    // A skipped transition (another navigation landed mid-fade) rejects
    // `ready` with "Transition was skipped". That is expected, not an error —
    // left unhandled it surfaces as an uncaught rejection on every quick
    // double navigation.
    transition.ready.catch(() => undefined);
    transition.updateCallbackDone.catch(() => undefined);
    // A navigation that lands mid-transition skips the running one (the
    // browser does that on its own), and still calls its update — so the flag
    // belongs to whichever transition is the latest.
    void transition.finished
        .catch(() => undefined)
        .finally(() => {
            if (active.current === transition) {
                root.removeAttribute(FLAG);
                active.current = null;
            }
        });
}

/**
 * `BrowserRouter`, plus a cross-fade of the work area when a navigation
 * changes the page (see {@link isPageChange}).
 *
 * It is `BrowserRouter`'s own few lines — the same `createBrowserHistory`
 * with `v5Compat`, the same `<Router>` — with one change in the history
 * listener: a page change is committed synchronously (`flushSync`) inside
 * `document.startViewTransition`, which is what lets the browser snapshot the
 * old page, apply the new one and fade between the two. React Router's own
 * `viewTransition` option exists only on the data routers, which this host
 * does not use.
 *
 * What is captured, and why only that, is in the design system's
 * `styles.css` ("Page cross-fade").
 */
export function PageTransitionRouter({ children }: { children: ReactNode }) {
    const historyRef = useRef<BrowserHistory | null>(null);
    if (historyRef.current === null) {
        historyRef.current = createBrowserHistory({ v5Compat: true });
    }
    const history = historyRef.current;

    const [state, setState] = useState<RouterState>(() => ({
        action: history.action,
        location: history.location
    }));
    // What is on screen, and what the latest navigation asked for — the
    // transition's update runs a frame later, after any number of others.
    const shown = useRef(state.location.pathname);
    const latest = useRef(state);
    const active = useRef<unknown>(null);

    useLayoutEffect(
        () =>
            history.listen(({ action, location }) => {
                const next = { action, location };
                latest.current = next;
                if (!isPageChange(shown.current, location.pathname)) {
                    shown.current = location.pathname;
                    setState(next);
                    return;
                }
                shown.current = location.pathname;
                crossFade(
                    () => flushSync(() => setState(latest.current)),
                    active
                );
            }),
        [history]
    );

    return (
        <Router
            location={state.location}
            navigationType={state.action}
            navigator={history}
        >
            {children}
        </Router>
    );
}
