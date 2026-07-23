import { createContext, useContext } from 'react';

/**
 * The DOM node the query builder's nested popovers (the field picker, a
 * relation value picker) portal into.
 *
 * When the builder is mounted inside a **scroll-locking** container — the
 * records `QueryBuilderDrawer` (vaul) or a Radix `Dialog` — react-remove-scroll
 * blocks mouse-wheel scrolling everywhere outside that container's subtree. A
 * popover portaled to `document.body` is outside it, so its list scrolls only by
 * dragging the scrollbar, never the wheel. Portaling the popover into the
 * locking container's own element (provided here) puts it back inside the
 * allow-listed subtree, so the wheel works again. `null` (the default) keeps the
 * body portal, correct for a builder that isn't inside a locked container.
 */
export const PortalContainerContext = createContext<HTMLElement | null>(null);

/** The container nested query-builder popovers should portal into, if any. */
export function usePortalContainer(): HTMLElement | null {
    return useContext(PortalContainerContext);
}
