import type { ComponentType, ReactNode } from 'react';
import { cn } from '@orthacms/design-system';

/** Props for {@link NextStepRow}. */
export type NextStepRowProps = {
    /** The leading icon. */
    icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
    /** Tints the icon tile. */
    tone: 'info' | 'success' | 'muted';
    /** What to do, e.g. "Write the first record". */
    title: string;
    /** Why, or what is already in place. */
    hint: ReactNode;
    /** The way to do it — a link-button. */
    action: ReactNode;
};

const TONE: Record<NextStepRowProps['tone'], string> = {
    info: 'bg-info-soft text-info-soft-foreground',
    success: 'bg-success-soft text-success-soft-foreground',
    muted: 'bg-muted text-muted-foreground'
};

/**
 * One of the "ready" screen's next steps: an icon tile, what to do and why,
 * and the button that does it.
 */
export function NextStepRow({
    icon: Icon,
    tone,
    title,
    hint,
    action
}: NextStepRowProps) {
    return (
        <li className="flex items-center gap-3 border-t px-4 py-3">
            <span
                aria-hidden
                className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-md',
                    TONE[tone]
                )}
            >
                <Icon className="size-4" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium">{title}</span>
                <span className="text-xs text-muted-foreground">{hint}</span>
            </span>
            {action}
        </li>
    );
}
