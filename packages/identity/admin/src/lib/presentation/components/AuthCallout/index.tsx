import type { ReactNode } from 'react';
import { cn } from '@orthacms/design-system';
import { InfoIcon } from '../AuthIcons';

/** Props for {@link AuthCallout}. */
type AuthCalloutProps = {
    /** What the callout says. */
    children: ReactNode;
    /**
     * `info` for news about how the visitor got here (a session that ended),
     * `muted` for a quiet consequence or tip (what an admin clicks, that other
     * devices will be signed out).
     */
    tone?: 'info' | 'muted';
    /** Extra classes. */
    className?: string;
};

/**
 * A quiet, non-interactive note inside an auth card — the boards' `callout`.
 * Not an `Alert`: nothing here failed and nothing needs announcing the moment
 * it appears; it is part of what the screen says, read in order after the
 * heading. A message that *does* need announcing (a session that ended under
 * the visitor) wraps it in `AuthNotice`, which adds the live role.
 */
export function AuthCallout({
    children,
    tone = 'muted',
    className
}: AuthCalloutProps) {
    return (
        <div
            className={cn(
                'flex items-start gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] leading-[18px]',
                tone === 'info'
                    ? 'bg-info-soft text-info-soft-foreground'
                    : 'border bg-muted/40 text-muted-foreground',
                className
            )}
        >
            <InfoIcon className="mt-px size-4 shrink-0" />
            <span>{children}</span>
        </div>
    );
}
