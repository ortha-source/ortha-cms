import { Check, Loader2, X } from 'lucide-react';
import { cn } from '@orthacms/design-system';
import type { ProgressState } from '../../../../domain/applyProgress';

type Props = {
    title: string;
    detail?: string;
    state: ProgressState;
    /** How long it took, already formatted; absent while it runs or when unseen. */
    time?: string;
    last?: boolean;
};

/**
 * One step of the apply as a stepper row: its mark (a check once done, a
 * spinner while it runs, a cross where it stopped), what it does, a detail,
 * and its time. The rule down to the next step is drawn solid once passed.
 */
export function ApplyStep({ title, detail, state, time, last }: Props) {
    return (
        <li
            className="relative flex gap-3 pb-5 last:pb-0"
            aria-current={state === 'current' ? 'step' : undefined}
        >
            {!last && (
                <span
                    aria-hidden
                    className={cn(
                        'absolute left-3 top-7 -bottom-0 w-px -translate-x-1/2',
                        state === 'done' ? 'bg-foreground' : 'bg-border'
                    )}
                />
            )}
            <span
                aria-hidden
                className={cn(
                    'relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border',
                    state === 'done' &&
                        'border-foreground bg-foreground text-background',
                    state === 'current' && 'border-info text-info',
                    state === 'failed' &&
                        'border-destructive bg-destructive text-destructive-foreground',
                    state === 'pending' && 'bg-background'
                )}
            >
                {state === 'done' ? (
                    <Check className="size-3.5" />
                ) : state === 'current' ? (
                    <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                ) : state === 'failed' ? (
                    <X className="size-3.5" />
                ) : null}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
                <span
                    className={cn(
                        'text-sm font-medium',
                        state === 'pending' && 'text-muted-foreground'
                    )}
                >
                    {title}
                </span>
                {detail && (
                    <span className="truncate text-xs text-muted-foreground">
                        {detail}
                    </span>
                )}
            </div>
            {time && (
                <span className="pt-0.5 text-xs tabular-nums text-muted-foreground">
                    {time}
                </span>
            )}
        </li>
    );
}
