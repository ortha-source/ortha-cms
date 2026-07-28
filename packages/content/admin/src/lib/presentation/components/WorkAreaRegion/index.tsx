import { useMemo, useState, type ReactNode } from 'react';
import { WorkAreaRegionContext } from '../../hooks/useWorkAreaRegion';

/**
 * Renders the page's routed content beside a **fillable region** that can take
 * the whole work area (see {@link useWorkAreaRegion}).
 *
 * While the region is filled the routed content is `display: none`, not
 * unmounted — the control filling the region lives inside it, and unmounting
 * the form would take the control, its portal, and the form's state with it.
 * `display: none` also removes it from the tab order and the accessibility
 * tree, so there is nothing behind the region to reach by accident.
 *
 * Unfilled, the wrapper is `display: contents`: it disappears from layout
 * entirely, so every route lays out exactly as it did before there was a
 * region here at all.
 */
export function WorkAreaRegion({ children }: { children: ReactNode }) {
    const [host, setHost] = useState<HTMLElement | null>(null);
    const [filled, setFilled] = useState(false);

    const value = useMemo(
        () => ({ host, filled, setFilled }),
        [host, filled]
    );

    return (
        <WorkAreaRegionContext.Provider value={value}>
            <div className={filled ? 'hidden' : 'contents'}>{children}</div>
            <div
                ref={setHost}
                className={
                    filled ? 'flex min-h-0 flex-1 flex-col' : 'hidden'
                }
            />
        </WorkAreaRegionContext.Provider>
    );
}
