import { Check, Circle, Loader2 } from 'lucide-react';
import { cn } from '@orthacms/design-system';

/** Where one step stands. */
export type StepState = 'done' | 'current' | 'pending';

/** One line of the progress list; the state is in the words of `label`'s list position and the mark. */
export function ApplyStep({
    label,
    state
}: {
    label: string;
    state: StepState;
}) {
    const Mark =
        state === 'done' ? Check : state === 'current' ? Loader2 : Circle;
    return (
        <li
            className={cn(
                'flex items-center gap-2 text-sm',
                state === 'pending' && 'text-muted-foreground'
            )}
            aria-current={state === 'current' ? 'step' : undefined}
        >
            <Mark
                className={cn(
                    'size-4 shrink-0',
                    state === 'current' &&
                        'animate-spin motion-reduce:animate-none'
                )}
                aria-hidden
            />
            {label}
        </li>
    );
}
