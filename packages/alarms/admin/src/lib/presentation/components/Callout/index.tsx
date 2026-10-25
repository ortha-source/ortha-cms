import type { ComponentType, ReactNode } from 'react';
import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@orthacms/design-system';

/** The three tones a callout takes — the design system's status tokens. */
export type CalloutTone = 'warn' | 'bad' | 'info';

const TONES: Record<
    CalloutTone,
    { box: string; icon: ComponentType<{ className?: string }> }
> = {
    warn: {
        box: 'border-warning/30 bg-warning-soft text-warning-soft-foreground',
        icon: TriangleAlert
    },
    bad: {
        box: 'border-destructive/30 bg-destructive-soft text-destructive-soft-foreground',
        icon: CircleAlert
    },
    info: {
        box: 'border-info/30 bg-info-soft text-info-soft-foreground',
        icon: Info
    }
};

/** Props for {@link Callout}. */
export type CalloutProps = {
    tone: CalloutTone;
    children: ReactNode;
    /**
     * Pass `"status"` for a callout that appears in response to something
     * the reader did (the inverted-condition hint). Static callouts — a broken
     * alarm on the list — take no role: a page of `role="alert"` banners
     * announces every one of them on load, which is noise, not information.
     */
    role?: 'status';
    /** Replaces the tone's own glyph. */
    icon?: ComponentType<{ className?: string }>;
    className?: string;
};

/**
 * A one-line tinted note with its glyph — the boards' `.callout`.
 *
 * Not the design system's `Alert`: that one is `role="alert"` always, and its
 * geometry is tuned for a title over a description (it absolutely positions a
 * top-level icon), which pushes a single sentence off its centre. These are
 * single sentences inside a card, so the icon and the text sit in one flex row.
 */
export function Callout({
    tone,
    children,
    role,
    icon,
    className
}: CalloutProps) {
    const { box, icon: ToneIcon } = TONES[tone];
    const Icon = icon ?? ToneIcon;
    return (
        <div
            role={role}
            className={cn(
                'flex items-start gap-2 rounded-lg border px-3 py-2 text-[13px] leading-5',
                box,
                className
            )}
        >
            <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">{children}</div>
        </div>
    );
}
