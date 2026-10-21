/**
 * The "picked up" look of a sortable item while it is dragged — shared so every
 * reorderable list in the admin lifts the same way.
 *
 * The item is the thing being moved (the lists use no `DragOverlay`), so it
 * stays fully opaque and rises: a larger shadow, a 2% scale and the grabbing
 * cursor, above its neighbours. The scale is Tailwind v4's standalone `scale`
 * property, which composes with the `transform` dnd-kit writes inline rather
 * than replacing it — and the transition names `scale` and `box-shadow`, never
 * `transform`, so it cannot fight dnd-kit's own glide.
 */
const DRAG_LIFT_BASE =
    'transition-[color,background-color,border-color,scale,box-shadow] duration-(--ds-duration-fast) ease-(--ds-ease-out) motion-reduce:transition-none';
const DRAG_LIFT_ACTIVE = 'relative z-10 scale-[1.02] shadow-lg cursor-grabbing';

/** The lift's transition in inline-style form, for {@link dragLiftTransition}. */
const DRAG_LIFT_INLINE =
    'scale var(--ds-duration-fast) var(--ds-ease-out), box-shadow var(--ds-duration-fast) var(--ds-ease-out)';

/**
 * Classes for a sortable item: the transition that animates the lift, always,
 * so the drop settles as smoothly as the pick-up — plus the lift itself while
 * `isDragging`. Replaces the item's own `transition-colors`, whose properties
 * it carries.
 */
export function dragLiftClassName(isDragging: boolean): string {
    return isDragging
        ? `${DRAG_LIFT_BASE} ${DRAG_LIFT_ACTIVE}`
        : DRAG_LIFT_BASE;
}

/**
 * dnd-kit's sortable `transition` for the item's inline style, with the lift's
 * appended. An inline `transition` replaces the class's outright, so while
 * dnd-kit sets one (a keyboard drag, the glide home after a drop) the lift
 * would otherwise snap. Under reduced motion nothing is appended — the inline
 * style would beat `motion-reduce:transition-none` too.
 */
export function dragLiftTransition(
    transition: string | undefined,
    reducedMotion: boolean
): string | undefined {
    if (!transition || reducedMotion) return transition;
    return `${transition}, ${DRAG_LIFT_INLINE}`;
}
