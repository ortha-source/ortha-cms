import { cn } from '../../utils';

/**
 * Props for the {@link Skeleton} component. Forwards native `div` props, so the
 * shape (width/height/radius) is set via `className` (e.g. `h-4 w-32`).
 */
type SkeletonProps = React.ComponentProps<'div'>;

/**
 * A single placeholder block for loading UI: a pulsing, rounded panel sized via
 * `className`. Purely decorative — it carries no text, so screen readers ignore
 * it. Compose several into a content-shaped placeholder, and wrap that
 * placeholder in a {@link SkeletonRegion} so the busy state is announced once
 * (the blocks themselves stay silent).
 *
 * The pulse is suppressed under `prefers-reduced-motion`. It is decorative —
 * the `role="status"` label is what actually conveys "busy" — so an animation
 * that loops for as long as the request takes is exactly the kind a
 * motion-sensitive user asked not to see. Fixing it here rather than at each
 * call site keeps every plugin's skeleton honest by default; `className` still
 * wins via `cn`, so a deliberate exception stays possible.
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
    return (
        <div
            className={cn(
                'animate-pulse motion-reduce:animate-none rounded-md bg-accent',
                className
            )}
            {...props}
        />
    );
}

/**
 * Props for the {@link SkeletonRegion} component.
 */
type SkeletonRegionProps = React.ComponentProps<'div'> & {
    /**
     * The announced busy text, e.g. `'Loading members…'`. Rendered `sr-only`;
     * the design system stays intl-agnostic, so pass a translated string.
     */
    label: string;
    /**
     * The page's `<h1>`, rendered visually hidden.
     *
     * For a **route-level** skeleton — the `Suspense` fallback a lazy page shows
     * while its chunk loads. That state is a whole page with no heading at all
     * until the real one mounts, and it is the state a slow connection sits in
     * longest, which makes it the one most likely to be navigated by heading
     * (`ORT-167`). Omit it for a skeleton *inside* a page whose header is
     * already on screen — a second `<h1>` is worse than none.
     */
    heading?: string;
};

/**
 * The announced wrapper a block of {@link Skeleton}s belongs in: one named
 * `role="status"` region, `aria-busy`, with the placeholder blocks hidden from
 * assistive tech inside it.
 *
 * This existed only as advice before. `Skeleton`'s JSDoc told consumers to wrap
 * their placeholders in a named `role="status"`, and nothing enforced it — so a
 * page transitioning into a loading state announced nothing at all and a blind
 * user could not tell whether the app was working or stuck (`ORT-161`). Making
 * the correct pattern the easy one is the point: a bare `Skeleton` now reads as
 * "I am handling the announcement myself".
 *
 * **One region per loading surface.** Two of these mounted at once are two live
 * regions competing to speak, which is the failure the `Spinner` half of this
 * fix removed. Wrap the whole placeholder, not each block.
 */
export function SkeletonRegion({
    label,
    heading,
    children,
    className,
    ...props
}: SkeletonRegionProps) {
    return (
        <div role="status" aria-busy className={className} {...props}>
            {heading ? <h1 className="sr-only">{heading}</h1> : null}
            <span className="sr-only">{label}</span>
            {/* The blocks carry no text, but they do carry structure — a
                skeleton table is still a `<table>` to a screen reader, and
                announcing its empty rows under a "Loading…" status is noise.
                Hidden here rather than at each call site so a consumer cannot
                forget.

                `contents` because this wrapper must not become a layout box: the
                caller's `className` sits on the region, and a real `<div>` in
                between would eat its `space-y-*`/`grid` and space *this* element
                instead of the placeholders. */}
            <div aria-hidden className="contents">
                {children}
            </div>
        </div>
    );
}
