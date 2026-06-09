import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@ortha-cms/design-system';

/** Props for {@link WizardFooter}. */
export type WizardFooterProps = {
    /** Quiet helper text shown on the left when there's no Back button. */
    hint?: ReactNode;
    /** Back handler — renders a Back button on the left when provided. */
    onBack?: () => void;
    /** Back button label. */
    backLabel?: string;
    /** Skip handler — renders a ghost Skip button before the primary action. */
    onSkip?: () => void;
    /** Skip button label. */
    skipLabel?: string;
    /** The primary action (already a Button with its own label/state). */
    primary: ReactNode;
};

/**
 * The contextual footer shared by every step: an optional Back button or hint
 * on the left, and an optional ghost Skip plus the primary action on the right.
 */
export function WizardFooter({
    hint,
    onBack,
    backLabel,
    onSkip,
    skipLabel,
    primary
}: WizardFooterProps) {
    return (
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
                {onBack ? (
                    <Button type="button" variant="outline" onClick={onBack}>
                        <ArrowLeft />
                        {backLabel}
                    </Button>
                ) : hint ? (
                    <p className="text-sm text-muted-foreground">{hint}</p>
                ) : null}
            </div>
            <div className="flex items-center gap-2">
                {onSkip ? (
                    <Button type="button" variant="ghost" onClick={onSkip}>
                        {skipLabel}
                    </Button>
                ) : null}
                {primary}
            </div>
        </div>
    );
}
