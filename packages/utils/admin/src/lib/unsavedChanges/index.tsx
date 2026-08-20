import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode
} from 'react';
import { useNavigate } from 'react-router-dom';

/** The guard's API, shared by every form and every navigation in the app. */
type UnsavedChangesApi = {
    /**
     * Register (or clear) this form's unsaved state. Returns nothing; call it
     * from an effect keyed on the form's dirtiness — see
     * {@link useUnsavedChanges}.
     */
    setDirty: (key: string, dirty: boolean) => void;
    /**
     * Run `proceed` — immediately when nothing is unsaved, otherwise after the
     * user confirms losing their edits. For **programmatic** navigation
     * (`navigate(...)`); plain links are intercepted automatically.
     */
    confirmNavigation: (proceed: () => void) => void;
    /** Whether any registered form currently holds unsaved edits. */
    isDirty: boolean;
};

const Context = createContext<UnsavedChangesApi | null>(null);

/** Copy for the confirm, supplied by the host so this stays i18n-free. */
export type UnsavedChangesCopy = {
    title: ReactNode;
    description: ReactNode;
    confirmLabel: ReactNode;
    cancelLabel: ReactNode;
};

/**
 * Renders the confirm — injected by the host so this module needs no direct
 * dependency on a dialog implementation or on `react-intl`.
 */
export type UnsavedChangesDialog = (props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
}) => ReactNode;

/**
 * App-wide "you have unsaved changes" guard.
 *
 * A form registers its dirtiness with {@link useUnsavedChanges}; from then on
 * **any** navigation away asks first:
 *
 * - **In-app links** are intercepted at the document level, in the capture
 *   phase, before React Router's own click handling — so every `<Link>`
 *   anywhere (sidebar, breadcrumb, "Back to records", a table row) is covered
 *   without touching a single call site. Modified clicks (new tab/window),
 *   downloads and `target=_blank` are left alone: they don't discard anything.
 * - **Programmatic** navigation goes through `confirmNavigation`, since there is
 *   no DOM event to intercept.
 * - **Leaving the page entirely** (reload, close, external URL) uses the native
 *   `beforeunload` prompt, which is the only thing browsers allow there.
 *
 * This is a `BrowserRouter` app, so React Router's `useBlocker` — which needs a
 * data router — isn't available; intercepting the click is the equivalent that
 * doesn't require migrating the whole route tree.
 */
export function UnsavedChangesProvider({
    dialog,
    children
}: {
    /** Renders the confirm dialog. */
    dialog: UnsavedChangesDialog;
    children: ReactNode;
}) {
    // Mounted inside the app's router, so a confirmed navigation can go through
    // the router itself rather than being re-dispatched at the History API.
    const navigate = useNavigate();

    // A set of keys, so several forms can be mounted and the guard is "any".
    const [dirtyKeys, setDirtyKeys] = useState<ReadonlySet<string>>(
        () => new Set()
    );
    const isDirty = dirtyKeys.size > 0;

    // Read by the DOM listener, which must see the latest value without being
    // re-bound on every keystroke.
    const dirtyRef = useRef(isDirty);
    dirtyRef.current = isDirty;

    // The navigation held back by an open confirm.
    const [pending, setPending] = useState<(() => void) | null>(null);

    const setDirty = useCallback((key: string, dirty: boolean) => {
        setDirtyKeys((current) => {
            if (dirty === current.has(key)) return current;
            const next = new Set(current);
            if (dirty) next.add(key);
            else next.delete(key);
            return next;
        });
    }, []);

    const confirmNavigation = useCallback((proceed: () => void) => {
        if (!dirtyRef.current) {
            proceed();
            return;
        }
        // Stored as a thunk — `setState` would otherwise *call* the function.
        setPending(() => proceed);
    }, []);

    // Intercept in-app link clicks before the router sees them.
    useEffect(() => {
        const onClick = (event: MouseEvent) => {
            if (!dirtyRef.current) return;
            if (event.defaultPrevented) return;
            // Anything but a plain left click is the user's explicit "open
            // elsewhere" — it leaves this form untouched.
            if (event.button !== 0) return;
            if (
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
            )
                return;

            const anchor = (event.target as HTMLElement | null)?.closest?.('a');
            if (!anchor) return;
            // `closest('a')` matches an `<a>` inside an SVG too, and an
            // `SVGAElement` has none of `HTMLAnchorElement`'s parsed URL parts:
            // `origin`, `pathname` and `search` are all `undefined`, so the
            // origin check below returned early and the link navigated with no
            // prompt at all. No SVG links exist in the admin today, which is
            // exactly why this was a silent hole rather than a deliberate
            // exemption (`ORT-136`). Resolving the href against the document
            // gives one shape to reason about, whichever element it came from —
            // and `href.baseVal` is where an `SVGAElement` keeps it.
            const rawHref =
                anchor.getAttribute('href') ??
                (anchor as unknown as { href?: { baseVal?: string } }).href
                    ?.baseVal ??
                null;
            if (!rawHref || rawHref.startsWith('#')) return;
            if (anchor.hasAttribute('download')) return;
            const target = anchor.getAttribute('target');
            if (target && target !== '_self') return;

            let destination: URL;
            try {
                destination = new URL(rawHref, window.location.href);
            } catch {
                // Not a URL this browser can resolve (a `javascript:` scheme, a
                // malformed value). Nothing to navigate to, so nothing to guard.
                return;
            }

            // External destinations unload the page; `beforeunload` covers those.
            if (destination.origin !== window.location.origin) return;
            // Already here — nothing would be lost.
            if (
                destination.pathname === window.location.pathname &&
                destination.search === window.location.search
            )
                return;

            event.preventDefault();
            // Deliberately **not** `stopPropagation()`. This is a capture-phase
            // listener, so stopping the event hid the click from every other
            // capture listener on the page — a dropdown's close-on-outside-click,
            // an analytics hook, a future route-announcer — and only while a form
            // happened to be dirty, which made any resulting difference
            // intermittent and near-impossible to attribute (`ORT-136`).
            // `preventDefault()` alone is what stops the navigation; suppressing
            // the event for everyone else was never part of that.
            const url =
                destination.pathname + destination.search + destination.hash;
            setPending(() => () => {
                // Hand the confirmed navigation to the router, which is what
                // the intercepted `<Link>` would have done. A raw
                // `pushState({}, '', url)` plus a synthetic `popstate` looks
                // equivalent but overwrites the state React Router keeps its
                // own history index in: the router reads the entry back as
                // index `undefined`, every later push writes `NaN`, and
                // Back/Forward deltas — which scroll restoration and any
                // blocker depend on — are wrong for the rest of the session.
                navigate(url);
            });
        };

        document.addEventListener('click', onClick, true);
        return () => document.removeEventListener('click', onClick, true);
    }, [navigate]);

    // Reload / close / external navigation — the browser's own prompt is the
    // only guard available, and it ignores custom copy by design.
    useEffect(() => {
        if (!isDirty) return;
        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [isDirty]);

    const api = useMemo<UnsavedChangesApi>(
        () => ({ setDirty, confirmNavigation, isDirty }),
        [setDirty, confirmNavigation, isDirty]
    );

    return (
        <Context.Provider value={api}>
            {children}
            {dialog({
                open: pending !== null,
                onOpenChange: (open) => {
                    if (!open) setPending(null);
                },
                onConfirm: () => {
                    const proceed = pending;
                    setPending(null);
                    // Deliberately *not* clearing the dirty set here. The
                    // answer the user gave is about the form they were asked
                    // about, and that form clears its own key as it unmounts.
                    // Clearing every key disarmed every other mounted form —
                    // a docked composer, a dialog form — for the rest of the
                    // session, and since `useUnsavedChanges` only re-registers
                    // when its own inputs change, nothing ever armed it again.
                    proceed?.();
                }
            })}
        </Context.Provider>
    );
}

/**
 * The guard's API, or `null` outside a {@link UnsavedChangesProvider} — so a
 * plugin rendered in isolation (tests, Storybook) degrades to no guard rather
 * than throwing.
 */
export function useUnsavedChangesApi(): UnsavedChangesApi | null {
    return useContext(Context);
}

/**
 * Register a form's unsaved state with the app-wide guard. Pass the live
 * dirtiness; the registration clears itself when the form unmounts, so a
 * navigated-away form never leaves the guard stuck on.
 */
export function useUnsavedChanges(dirty: boolean, key = 'form'): void {
    const api = useUnsavedChangesApi();
    const setDirty = api?.setDirty;
    useEffect(() => {
        if (!setDirty) return;
        setDirty(key, dirty);
        return () => setDirty(key, false);
    }, [setDirty, key, dirty]);
}
