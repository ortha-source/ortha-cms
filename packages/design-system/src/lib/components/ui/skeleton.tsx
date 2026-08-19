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
    children,
    className,
    ...props
}: SkeletonRegionProps) {
    return (
        <div role="status" aria-busy className={className} {...props}>
            <span className="sr-only">{label}</span>
            {/* The blocks carry no text, but they do carry structure — a
                skeleton table is still a `<table>` to a screen reader, and
                announcing its empty rows under a "Loading…" status is noise.
                Hidden here rather than at each call site so a consumer cannot
                forget. */}
            <div aria-hidden>{children}</div>
        </div>
    );
}
