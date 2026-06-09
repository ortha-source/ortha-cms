import type { ReactNode } from 'react';
import { Card, cn } from '@ortha-cms/design-system';

/** Props for {@link StepCard}. */
export type StepCardProps = {
    /** Step body. */
    children: ReactNode;
    /** Extra classes. */
    className?: string;
};

/**
 * Card wrapper for a wizard step. The page gives it `key={step}` so it remounts
 * on each step change and replays the `wizard-step-in` entrance.
 *
 * The animation transforms only — opacity stays 1 at all times — so content is
 * never hidden if the motion clock is paused (background tab, print) and the
 * `prefers-reduced-motion: reduce` query disables it entirely. Both rules live
 * in `apps/admin/src/styles.css`.
 */
export function StepCard({ children, className }: StepCardProps) {
    return <Card className={cn('wizard-step-in', className)}>{children}</Card>;
}
