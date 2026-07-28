import { createContext, useContext } from 'react';

/**
 * The **work-area region** — the part of the content pane below the top bar
 * that a field can take over entirely.
 *
 * A form control cannot hide its own siblings: it has no reach outside itself.
 * So the page owns a region, and a control that needs the whole work area fills
 * it by **portal** — the page then hides the form behind it. The form stays
 * mounted (a portal moves only DOM, never the React tree), which is the whole
 * point: the control doing the filling *lives* in that form, and its value is
 * the form's state.
 *
 * The same idiom as the shell's `PageActionsPortal` / `RightPanelPortal`, one
 * level down: the region belongs to the page because the top bar it sits under
 * is the page's, not the shell's.
 */
export interface WorkAreaRegion {
    /** The region's DOM node, once mounted. `null` outside a provider. */
    readonly host: HTMLElement | null;
    /** Whether something is currently filling it (the form is hidden). */
    readonly filled: boolean;
    /** Claims or releases the region. */
    setFilled(filled: boolean): void;
}

const EMPTY: WorkAreaRegion = {
    host: null,
    filled: false,
    setFilled: () => undefined
};

/** Context backing {@link useWorkAreaRegion}. */
export const WorkAreaRegionContext = createContext<WorkAreaRegion>(EMPTY);

/**
 * The page's work-area region. Outside a provider it reports no host, and a
 * control that wanted one falls back to rendering in place — so a field is
 * usable in any form, not only in this page.
 */
export function useWorkAreaRegion(): WorkAreaRegion {
    return useContext(WorkAreaRegionContext);
}
