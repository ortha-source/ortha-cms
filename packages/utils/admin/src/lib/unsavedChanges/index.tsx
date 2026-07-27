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
            const href = anchor.getAttribute('href');
            if (!href || href.startsWith('#')) return;
            if (anchor.hasAttribute('download')) return;
            const target = anchor.getAttribute('target');
            if (target && target !== '_self') return;
            // External destinations unload the page; `beforeunload` covers those.
            if (anchor.origin !== window.location.origin) return;
            // Already here — nothing would be lost.
            if (
                anchor.pathname === window.location.pathname &&
                anchor.search === window.location.search
            )
                return;

            event.preventDefault();
            event.stopPropagation();
            const url = anchor.pathname + anchor.search + anchor.hash;
            setPending(() => () => {
                // Re-dispatch as a real click once confirmed. Cheaper and safer
                // than reaching for the router here: the anchor already knows
                // where it goes, and the guard is clear by then.
                window.history.pushState({}, '', url);
                window.dispatchEvent(new PopStateEvent('popstate'));
            });
        };

        document.addEventListener('click', onClick, true);
        return () => document.removeEventListener('click', onClick, true);
    }, []);

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
                    // Clear the guard first: the pending navigation is the
                    // user's answer, and the form is about to unmount anyway.
                    setDirtyKeys(new Set());
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
