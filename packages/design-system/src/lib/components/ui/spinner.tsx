import { Loader2Icon } from 'lucide-react';
import { cn } from '../../utils';

/**
 * Props for the {@link Spinner} component. Forwards native SVG props, so size
 * and color follow `currentColor`/`className` (e.g. `size-4`).
 */
type SpinnerProps = React.ComponentProps<'svg'>;

/**
 * Indeterminate loading spinner. A spinning lucide loader with
 * `role="status"`, sized via `className` (defaults to `size-4`). Inside a
 * button, pair it with an `sr-only` label so the busy state is announced.
 */
export function Spinner({ className, ...props }: SpinnerProps) {
    return (
        <Loader2Icon
            role="status"
            className={cn('size-4 animate-spin', className)}
            {...props}
        />
    );
}
