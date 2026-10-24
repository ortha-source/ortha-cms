import { Fragment } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@orthacms/design-system';

/** One step on the {@link WizardProgress} line. */
export type WizardProgressStep = {
    /** Short label, e.g. "Basics". */
    label: string;
};

/** Props for {@link WizardProgress}. */
export type WizardProgressProps = {
    /** The steps, in order. */
    steps: readonly WizardProgressStep[];
    /** The active step (1-based). */
    current: number;
    /** The furthest step reached; steps up to it can be revisited. */
    maxReached: number;
    /** Go back (or forward, within reach) to a step. */
    onStepClick: (step: number) => void;
    /** The accessible name of the list, e.g. "Progress". */
    label: string;
    /** A step's accessible name, e.g. "Step 2: Content, completed". */
    stepLabel: (
        step: WizardProgressStep,
        number: number,
        state: 'complete' | 'current' | 'upcoming'
    ) => string;
};

/**
 * The wizard's progress as one horizontal line — "✓ Basics — 2 Content — 3
 * People": a check on a finished step, the number on the current and upcoming
 * ones. A reached step is a button, so going back is one click; an upcoming
 * one is plain text, since there is nothing to jump to yet. The current step
 * carries `aria-current="step"`.
 */
export function WizardProgress({
    steps,
    current,
    maxReached,
    onStepClick,
    label,
    stepLabel
}: WizardProgressProps) {
    return (
        <ol aria-label={label} className="flex flex-wrap items-center gap-3">
            {steps.map((step, index) => {
                const n = index + 1;
                const active = n === current;
                const reached = n <= maxReached;
                const complete = reached && !active && n < current;
                const state = active
                    ? 'current'
                    : complete
                      ? 'complete'
                      : 'upcoming';
                const marker = (
                    <>
                        <span
                            aria-hidden
                            className={cn(
                                'flex size-[22px] shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                                active && 'bg-primary text-primary-foreground',
                                complete &&
                                    'bg-success-soft text-success-soft-foreground',
                                !active &&
                                    !complete &&
                                    'border text-muted-foreground'
                            )}
                        >
                            {complete ? <Check className="size-3" /> : n}
                        </span>
                        <span
                            aria-hidden
                            className={cn(
                                'text-sm',
                                active
                                    ? 'font-medium text-foreground'
                                    : 'text-muted-foreground'
                            )}
                        >
                            {step.label}
                        </span>
                    </>
                );
                return (
                    <Fragment key={index}>
                        {index > 0 ? (
                            <li
                                aria-hidden
                                className="h-px w-12 shrink-0 bg-border"
                            />
                        ) : null}
                        <li
                            aria-current={active ? 'step' : undefined}
                            className="flex"
                        >
                            {reached && !active ? (
                                <button
                                    type="button"
                                    onClick={() => onStepClick(n)}
                                    aria-label={stepLabel(step, n, state)}
                                    className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    {marker}
                                </button>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <span className="sr-only">
                                        {stepLabel(step, n, state)}
                                    </span>
                                    {marker}
                                </span>
                            )}
                        </li>
                    </Fragment>
                );
            })}
        </ol>
    );
}
