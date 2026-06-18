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
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
    return (
        <div
            className={cn('animate-pulse rounded-md bg-accent', className)}
            {...props}
        />
    );
}
