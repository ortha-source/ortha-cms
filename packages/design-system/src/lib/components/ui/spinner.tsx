import { Loader2Icon } from 'lucide-react';
import { cn } from '../../utils';

/**
 * Props for the {@link Spinner} component. Forwards native SVG props, so size
 * and color follow `currentColor`/`className` (e.g. `size-4`).
 */
type SpinnerProps = React.ComponentProps<'svg'>;

/**
 * Indeterminate loading spinner: a spinning lucide loader, sized via
 * `className` (defaults to `size-4`).
 *
 * **Decorative by default** (`aria-hidden`), which is a deliberate reversal.
 * It used to carry `role="status"` on the `<svg>` itself with no text inside —
 * a live region with nothing in it announces nothing, so the role bought no
 * announcement while four spinners on one page created four competing regions.
 * The busy state has to be announced by something that has words: wrap the
 * spinner in a named `role="status"` region (see `AppLoader` for the reference
 * implementation), or put it inside a button whose label already says what is
 * happening. Passing `aria-hidden={false}` opts back out.
 */
export function Spinner({ className, ...props }: SpinnerProps) {
    return (
        <Loader2Icon
            aria-hidden
            className={cn('size-4 animate-spin', className)}
            {...props}
        />
    );
}
