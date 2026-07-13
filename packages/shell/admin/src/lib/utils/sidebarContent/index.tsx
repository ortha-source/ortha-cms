import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode
} from 'react';

/** The contextual region a consumer can inject, plus its setter. */
type SidebarContentValue = {
    /** The node currently overriding the sidebar's contextual region, if any. */
    content: ReactNode;
    /** Replace (or clear, with `null`) the contextual region. */
    setContent: (node: ReactNode) => void;
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
    const [content, setContent] = useState<ReactNode>(null);
    return (
        <SidebarContentContext.Provider value={{ content, setContent }}>
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
    const { setContent } = ctx;
    useEffect(() => {
        setContent(render());
        return () => setContent(null);
        // `render` is intentionally excluded — the caller controls rebuilds via
        // `deps`, mirroring the useEffect contract (a raw JSX node would differ
        // every render and loop).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setContent, ...deps]);
}
