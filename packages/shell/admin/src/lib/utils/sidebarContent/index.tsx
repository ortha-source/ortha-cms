import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode
} from 'react';

/**
 * Who installed the current override. Identity-only — the region holds exactly
 * one node, so the token is how a caller's cleanup can tell "I am still the one
 * showing" from "someone else took over after me".
 */
type SidebarContentOwner = symbol;

/** The contextual region a consumer can inject, plus its setter. */
type SidebarContentValue = {
    /** The node currently overriding the sidebar's contextual region, if any. */
    content: ReactNode;
    /** Install `node` as the override, recording `owner` as its owner. */
    setContent: (node: ReactNode, owner: SidebarContentOwner) => void;
    /** Clear the override — but only if `owner` is still the one showing. */
    clearContent: (owner: SidebarContentOwner) => void;
};

const SidebarContentContext = createContext<SidebarContentValue | null>(null);

/**
 * Holds the sidebar's swappable contextual region. The shell renders its
 * default (global) nav when no override is set; a descendant route (e.g. the
 * workspace shell) can take over the region via {@link useSidebarContent}. This
 * is what makes the single sidebar *dynamic* without the shell depending on the
 * feature plugins that fill it — the same inversion the slots use, but for a
 * whole route-scoped panel rather than declarative items.
 */
export function SidebarContentProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<{
        owner: SidebarContentOwner | null;
        content: ReactNode;
    }>({ owner: null, content: null });

    const setters = useRef({
        setContent: (node: ReactNode, owner: SidebarContentOwner) =>
            setState({ owner, content: node }),
        // Ownership-checked: the region holds one node, so the last caller to
        // mount wins — and its predecessor's unmount cleanup used to blank the
        // winner's nav, leaving the sidebar's whole middle region empty until the
        // next route change. A stale owner's cleanup is now a no-op.
        clearContent: (owner: SidebarContentOwner) =>
            setState((current) =>
                current.owner === owner
                    ? { owner: null, content: null }
                    : current
            )
    }).current;

    const value = useMemo<SidebarContentValue>(
        () => ({ content: state.content, ...setters }),
        [state.content, setters]
    );

    return (
        <SidebarContentContext.Provider value={value}>
            {children}
        </SidebarContentContext.Provider>
    );
}

/**
 * Reads the current override node (used by {@link AppSidebar}). Returns `null`
 * when nothing has taken over the region — the caller falls back to the global
 * nav. Throws outside a {@link SidebarContentProvider}.
 */
export function useSidebarContentOverride(): ReactNode {
    const ctx = useContext(SidebarContentContext);
    if (!ctx) {
        throw new Error(
            'useSidebarContentOverride must be used within a SidebarContentProvider.'
        );
    }
    return ctx.content;
}

/**
 * Overrides the sidebar's contextual region for as long as the calling
 * component is mounted, clearing it on unmount. Pass a `render` factory plus a
 * `deps` array (as with `useEffect`) so the injected node is rebuilt only when
 * its inputs change — passing raw JSX would recreate the element every render
 * and loop. Typical use: the workspace shell injects its per-workspace nav.
 *
 * The region holds **one** node, so two callers mounted at once are last-writer-
 * wins. That part is by design; what was not is that the loser's cleanup then
 * cleared the *winner's* content — a component unmounting after being overridden
 * blanked the sidebar's whole middle region, and only a route change brought it
 * back. Each caller now holds an ownership token, and clearing is a no-op unless
 * it is still the one showing.
 *
 * @example
 * ```tsx
 * useSidebarContent(() => <WorkspaceNav workspace={current} />, [current.id]);
 * ```
 */
export function useSidebarContent(
    render: () => ReactNode,
    deps: readonly unknown[]
) {
    const ctx = useContext(SidebarContentContext);
    if (!ctx) {
        throw new Error(
            'useSidebarContent must be used within a SidebarContentProvider.'
        );
    }
    const { setContent, clearContent } = ctx;
    // One token per calling component instance, stable across its whole life.
    const owner = useRef<SidebarContentOwner>(Symbol('sidebarContent')).current;
    useEffect(() => {
        setContent(render(), owner);
        return () => clearContent(owner);
        // `render` is intentionally excluded — the caller controls rebuilds via
        // `deps`, mirroring the useEffect contract (a raw JSX node would differ
        // every render and loop).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setContent, clearContent, owner, ...deps]);
}
