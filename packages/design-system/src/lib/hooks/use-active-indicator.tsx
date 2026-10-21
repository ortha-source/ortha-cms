import * as React from 'react';

/** Where the active item sits, in the container's own coordinates. */
export type ActiveIndicatorRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

/**
 * Tracks the active item of a strip of options — a tab bar, a segmented
 * control — so one shared indicator can **slide** to it instead of each item
 * drawing its own and the selection jumping from one to the next.
 *
 * Attach `ref` to the container (which must be `position: relative`, so the
 * items' `offsetLeft/Top` are measured from it) and pass a selector that
 * matches the active item among its descendants: `[data-state=active]` for
 * Radix tabs, `[aria-current=page]` for route-backed links. The rect follows
 * everything that can move the item — the selection itself (a
 * `MutationObserver` on the attributes that carry it), items being added or
 * removed, the container or any item resizing, and web fonts landing.
 *
 * `rect` is `null` until there is an active item to point at, so the caller
 * can keep its own static active style until then — that is what a first
 * render, a server render, jsdom and a strip with nothing selected all see.
 *
 * `settled` turns true one frame **after** the first measurement. A caller
 * gates its transition on it so the indicator appears in place on mount rather
 * than sliding in from the container's corner.
 */
export function useActiveIndicator<T extends HTMLElement>(selector: string) {
    const ref = React.useRef<T>(null);
    const [rect, setRect] = React.useState<ActiveIndicatorRect | null>(null);
    const [settled, setSettled] = React.useState(false);

    React.useLayoutEffect(() => {
        const root = ref.current;
        if (!root) return;

        const measure = () => {
            const active = root.querySelector<HTMLElement>(selector);
            const next =
                active && active.offsetWidth > 0
                    ? {
                          x: active.offsetLeft,
                          y: active.offsetTop,
                          width: active.offsetWidth,
                          height: active.offsetHeight
                      }
                    : null;
            setRect((prev) =>
                prev &&
                next &&
                prev.x === next.x &&
                prev.y === next.y &&
                prev.width === next.width &&
                prev.height === next.height
                    ? prev
                    : next
            );
        };

        measure();

        const resize =
            typeof ResizeObserver === 'undefined'
                ? null
                : new ResizeObserver(measure);
        const observeItems = () => {
            if (!resize) return;
            resize.observe(root);
            for (const child of Array.from(root.children)) {
                resize.observe(child);
            }
        };
        observeItems();

        const mutations = new MutationObserver((records) => {
            if (records.some((record) => record.type === 'childList')) {
                observeItems();
            }
            measure();
        });
        mutations.observe(root, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['data-state', 'aria-current', 'aria-selected']
        });

        let cancelled = false;
        void document.fonts?.ready.then(() => {
            if (!cancelled) measure();
        });

        const frame = requestAnimationFrame(() => setSettled(true));

        return () => {
            cancelled = true;
            cancelAnimationFrame(frame);
            mutations.disconnect();
            resize?.disconnect();
        };
    }, [selector]);

    return { ref, rect, settled };
}

/**
 * One ref callback that feeds several refs — the indicator's own and the one a
 * `forwardRef` component was handed.
 */
export function mergeRefs<T>(
    ...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> {
    return (node) => {
        for (const ref of refs) {
            if (typeof ref === 'function') ref(node);
            else if (ref)
                (ref as React.MutableRefObject<T | null>).current = node;
        }
    };
}
