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
 * placeholder in a `role="status"` region with an `sr-only` label so the busy
 * state is announced once (the blocks themselves stay silent).
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
