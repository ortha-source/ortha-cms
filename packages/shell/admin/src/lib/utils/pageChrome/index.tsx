import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode
} from 'react';
import { createPortal } from 'react-dom';

/** The right panel as the chrome sees it: whether there is one, and its state. */
export type RightPanel = {
    /** Whether a page has registered a panel — nothing renders without one. */
    present: boolean;
    /** Whether the panel column is shown (false = collapsed away). */
    open: boolean;
    /** The registered panel's heading. */
    title: string;
    /** Collapse an open panel, or reopen a collapsed one. */
    toggle: () => void;
};

type PageChromeValue = RightPanel & {
    /** The top bar's actions container, once the bar has mounted one. */
    actionsHost: HTMLElement | null;
    setActionsHost: (node: HTMLElement | null) => void;
    /** The right panel's body container. */
    panelHost: HTMLElement | null;
    setPanelHost: (node: HTMLElement | null) => void;
    /** Registers a panel + its title while a filler is mounted. */
    registerPanel: (title: string) => () => void;
};

const Context = createContext<PageChromeValue | null>(null);

/**
 * DOM id of the right panel, so the top bar's expand button can `aria-controls`
 * it — the control and the region live in different components, and this is the
 * only thing tying them together.
 */
export const RIGHT_PANEL_ID = 'app-right-panel';

/** localStorage key for the right panel's open/collapsed state. */
const STORAGE_KEY = 'ortha:right-panel';

/** Reads the persisted state, tolerating missing/blocked/corrupt storage. */
function readOpen(): boolean {
    if (typeof window === 'undefined') return true;
    try {
        return window.localStorage.getItem(STORAGE_KEY) !== 'collapsed';
    } catch {
        return true;
    }
}

/**
 * Holds the two **page-chrome regions** the shell owns but doesn't fill: the top
 * bar's trailing actions region, and the right panel beside the main inset.
 *
 * Both are filled by **portal**, not by handing a node up the way
 * `useSidebarContent` does. React resolves context by where a node is *rendered*,
 * so a node the shell renders would be cut off from everything below it — the
 * open workspace (`useCurrentWorkspace`), a plugin's own slot context, a page's
 * form state and handlers. `createPortal` moves only the DOM and keeps the React
 * tree, so a filler stays inside the page that owns it. (`ContentNavSection` in
 * content-admin shows the alternative: it has to re-resolve the workspace itself
 * because it renders above the provider.)
 *
 * The panel's open/collapsed state lives here rather than with the filler,
 * because the control that flips it is chrome — it has to work from the top bar
 * when the panel is collapsed and the filler has nowhere to draw. It is
 * persisted (guarded, so private mode degrades to in-memory) since pages remount
 * constantly and a collapse the user asked for shouldn't spring back.
 */
export function PageChromeProvider({ children }: { children: ReactNode }) {
    const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null);
    const [panelHost, setPanelHost] = useState<HTMLElement | null>(null);
    // Ref-counted, so the overlap while a page remounts can't read as "gone".
    const [panels, setPanels] = useState<string[]>([]);
    const [open, setOpen] = useState<boolean>(readOpen);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(
                STORAGE_KEY,
                open ? 'open' : 'collapsed'
            );
        } catch {
            // Storage unavailable (private mode, quota) — keep it in memory.
        }
    }, [open]);

    const registerPanel = useCallback((title: string) => {
        setPanels((current) => [...current, title]);
        return () =>
            setPanels((current) => {
                const at = current.indexOf(title);
                if (at === -1) return current;
                const next = current.slice();
                next.splice(at, 1);
                return next;
            });
    }, []);

    const toggle = useCallback(() => setOpen((current) => !current), []);

    const value = useMemo<PageChromeValue>(
        () => ({
            present: panels.length > 0,
            // The newest registration wins, so a page that mounts over another
            // heads the panel with its own title.
            title: panels[panels.length - 1] ?? '',
            open,
            toggle,
            actionsHost,
            setActionsHost,
            panelHost,
            setPanelHost,
            registerPanel
        }),
        [panels, open, toggle, actionsHost, panelHost, registerPanel]
    );

    return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Reads the chrome context; throws outside a {@link PageChromeProvider}. */
function usePageChrome(): PageChromeValue {
    const ctx = useContext(Context);
    if (!ctx) {
        throw new Error(
            'Page chrome components must be used within a PageChromeProvider.'
        );
    }
    return ctx;
}

/**
 * The right panel's state, for the chrome that draws it (the panel column and
 * the top bar's expand button). Returns `null` outside a provider, so a bar
 * rendered in isolation (a test, a story) simply shows no panel controls.
 */
export function useRightPanel(): RightPanel | null {
    const ctx = useContext(Context);
    if (!ctx) return null;
    const { present, open, title, toggle } = ctx;
    return { present, open, title, toggle };
}

/**
 * Renders its children into the **top bar's trailing actions region** — the page
 * actions a bar can't know about (the entry editor's Publish + ⋯). Renders
 * nothing until a bar with a `PageActions` region is on screen, so a page that
 * mounts before its bar simply appears a frame later.
 *
 * Mount it from inside the page that owns the actions: the children keep that
 * page's context, so handlers, permissions and busy state all still resolve.
 */
export function PageActionsPortal({ children }: { children: ReactNode }) {
    const { actionsHost } = usePageChrome();
    return actionsHost ? createPortal(children, actionsHost) : null;
}

/**
 * Renders its children into the shell's **right panel**, and registers the panel
 * (with its heading) for as long as this is mounted — that registration is what
 * makes the column and its toggle exist at all.
 *
 * The children stay mounted while the panel is collapsed (the host is hidden,
 * not unmounted), so collapsing never throws away their state or refetches their
 * data.
 */
export function RightPanelPortal({
    title,
    children
}: {
    /** The panel's heading, shown in its header row. */
    title: string;
    children: ReactNode;
}) {
    const { panelHost, registerPanel } = usePageChrome();

    useEffect(() => registerPanel(title), [registerPanel, title]);

    return panelHost ? createPortal(children, panelHost) : null;
}

/** Internal: the hosts, for the shell chrome that mounts them. */
export function usePageChromeHosts() {
    const { setActionsHost, setPanelHost, present, open } = usePageChrome();
    return { setActionsHost, setPanelHost, present, open };
}
