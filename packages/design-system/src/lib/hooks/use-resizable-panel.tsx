import * as React from 'react';

import {
    clampWidth,
    type ResizeHandleProps
} from '../components/ui/resize-handle';
import { usePanelLayoutEntry } from '../panelLayout';

/** What a panel declares about itself to {@link useResizablePanel}. */
export type ResizablePanelOptions = {
    /** Stable panel id in the layout store — `<plugin>.<panel>`. */
    id: string;
    /** Width before the user has resized it, in pixels. */
    defaultWidth: number;
    /** Narrowest width, in pixels. */
    minWidth: number;
    /** Widest width, in pixels. */
    maxWidth: number;
    /**
     * The most of the viewport's width the panel may take, `0`–`1`. Applied
     * on top of `maxWidth`, so a width chosen on a wide monitor is narrowed —
     * at render, not in storage — on a laptop, and the page beside it keeps
     * room to work. Never below `minWidth`.
     */
    maxViewportRatio?: number;
    /** Whether dragging past the minimum (or `Enter`) collapses the panel. */
    collapsible?: boolean;
    /**
     * The CSS custom property the width is published as (`--sidebar-width`).
     * The panel sizes itself from it, which is what lets a drag move the panel
     * by writing one property instead of re-rendering its owner.
     */
    cssVar: `--${string}`;
};

/** What {@link useResizablePanel} hands back. */
export type ResizablePanel = {
    /** The width to render at: stored (or default), clamped to the bounds. */
    width: number;
    /** Whether the panel is collapsed. Always `false` when not collapsible. */
    collapsed: boolean;
    /** Records a collapse or an expand as the user's choice. */
    setCollapsed: (collapsed: boolean) => void;
    /** Spread onto the element that declares the CSS variable. */
    style: React.CSSProperties;
    /** Attach to that same element — the drag writes its preview there. */
    ref: React.RefCallback<HTMLElement>;
    /**
     * Everything {@link ResizeHandle} needs but its `edge` and `label`.
     * `onCollapse` is set for a collapsible panel; override it when collapsing
     * has to go through the owner's own toggle.
     */
    handleProps: Omit<ResizeHandleProps, 'edge' | 'label'>;
};

/** Subscribes to window resizes. */
function subscribeToResize(onChange: () => void) {
    window.addEventListener('resize', onChange);
    return () => window.removeEventListener('resize', onChange);
}

/**
 * The effective maximum — re-renders only when the cap itself moves, not on
 * every resize event, since the owner of a panel is often the whole app shell.
 */
function useEffectiveMax(min: number, max: number, ratio?: number): number {
    return React.useSyncExternalStore(
        subscribeToResize,
        () =>
            ratio && window.innerWidth > 0
                ? Math.max(
                      min,
                      Math.min(max, Math.floor(window.innerWidth * ratio))
                  )
                : Math.max(min, max),
        () => Math.max(min, max)
    );
}

/**
 * A resizable panel's width and collapsed state, read from and written to the
 * surrounding `PanelLayoutProvider` (in-memory when there is none), plus the
 * props that wire a {@link ResizeHandle} to it.
 *
 * The panel renders its width from `style` (a CSS variable). During a drag the
 * handle writes previews straight to that variable on the element behind
 * `ref`, and marks it `data-resizing` so its transitions can stand down; only
 * the release commits, so the owner re-renders once per drag rather than once
 * per pointer move.
 *
 * @example
 * ```tsx
 * const rail = useResizablePanel({
 *     id: 'copilot.agentsRail', defaultWidth: 288, minWidth: 224,
 *     maxWidth: 448, maxViewportRatio: 0.25, cssVar: '--agents-rail-width'
 * });
 * <aside ref={rail.ref} style={rail.style} className="relative w-(--agents-rail-width)">
 *     …
 *     <ResizeHandle {...rail.handleProps} edge="right" label="Resize chats" />
 * </aside>
 * ```
 */
export function useResizablePanel({
    id,
    defaultWidth,
    minWidth,
    maxWidth,
    maxViewportRatio,
    collapsible = false,
    cssVar
}: ResizablePanelOptions): ResizablePanel {
    const [entry, update] = usePanelLayoutEntry(id);
    const max = useEffectiveMax(minWidth, maxWidth, maxViewportRatio);
    const width = clampWidth(entry?.width ?? defaultWidth, minWidth, max);
    const collapsed = collapsible && !!entry?.collapsed;

    const element = React.useRef<HTMLElement | null>(null);
    const ref = React.useCallback((node: HTMLElement | null) => {
        element.current = node;
    }, []);

    const setCollapsed = React.useCallback(
        (next: boolean) => update({ collapsed: next }),
        [update]
    );

    const handleProps = React.useMemo<ResizablePanel['handleProps']>(
        () => ({
            value: width,
            min: minWidth,
            max,
            defaultValue: clampWidth(defaultWidth, minWidth, max),
            onPreview: (next) =>
                element.current?.style.setProperty(cssVar, `${next}px`),
            onCommit: (next) => update({ width: next }),
            onCollapse: collapsible
                ? () => update({ collapsed: true })
                : undefined,
            onResizeStart: () => {
                if (element.current)
                    element.current.dataset['resizing'] = 'true';
            },
            onResizeEnd: () => {
                if (element.current) delete element.current.dataset['resizing'];
            }
        }),
        [width, minWidth, max, defaultWidth, cssVar, collapsible, update]
    );

    const style = React.useMemo(
        () => ({ [cssVar]: `${width}px` }) as React.CSSProperties,
        [cssVar, width]
    );

    return { width, collapsed, setCollapsed, style, ref, handleProps };
}
