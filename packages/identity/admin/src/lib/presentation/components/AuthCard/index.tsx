import type { ReactNode } from 'react';
import { cn } from '@orthacms/design-system';

/** The tone of an {@link AuthCard}'s status mark. */
type AuthCardTone = 'success' | 'warning' | 'muted';

const TONES: Record<AuthCardTone, string> = {
    success: 'bg-success-soft text-success-soft-foreground',
    warning: 'bg-warning-soft text-warning-soft-foreground',
    muted: 'bg-muted text-muted-foreground'
};

/** Props for {@link AuthCard}. */
type AuthCardProps = {
    /** The screen's `<h1>` text. Every public auth screen has exactly one. */
    title: ReactNode;
    /** The line under the heading — what this screen is for, or what happened. */
    description?: ReactNode;
    /**
     * A round status mark above the heading — the done tick, the expired
     * clock, the broken link. Decorative: the heading says the same thing.
     */
    icon?: ReactNode;
    /** The mark's colour. Defaults to `muted`. */
    tone?: AuthCardTone;
    /**
     * Content rendered **above** the heading — the "your session ended"
     * callout the sign-in screen opens with when it was not the visitor's
     * choice to be here.
     */
    lead?: ReactNode;
    /**
     * Replaces the default heading block entirely, for a screen whose heading
     * is not a plain title (the invitation's "who and what" row). It must
     * still contain the screen's one `<h1>`.
     */
    header?: ReactNode;
    /** The card's body — the form, the actions. */
    children?: ReactNode;
    /** Extra classes for the card. */
    className?: string;
};

/**
 * The one card every public auth screen is drawn on — sign-in, the
 * forgotten-password request, accepting an invitation, choosing a new password
 * and the dead-link pages alike: a 16px-radius panel with a soft drop shadow,
 * a 22px heading and its line of context, and the content in one 16px-gap
 * column.
 *
 * The heading is a real `<h1>`, because {@link AuthLayout} moves focus to it
 * on arrival — that is how a keyboard or screen-reader user learns which
 * screen they have reached. A card that rendered none would leave them on
 * `<body>`.
 */
export function AuthCard({
    title,
    description,
    icon,
    tone = 'muted',
    lead,
    header,
    children,
    className
}: AuthCardProps) {
    return (
        <section
            className={cn(
                'flex w-full flex-col gap-4 rounded-2xl border bg-card p-7 text-card-foreground shadow-[0_12px_32px_rgba(16,16,24,0.06)]',
                className
            )}
        >
            {lead}
            {icon && (
                <span
                    aria-hidden="true"
                    className={cn(
                        'inline-flex size-10 items-center justify-center rounded-full [&_svg]:size-5',
                        TONES[tone]
                    )}
                >
                    {icon}
                </span>
            )}
            {header ?? (
                <div className="flex flex-col gap-1">
                    <h1 className="text-[22px] font-semibold leading-7 tracking-tight">
                        {title}
                    </h1>
                    {description && (
                        <div className="text-sm text-muted-foreground">
                            {description}
                        </div>
                    )}
                </div>
            )}
            {children}
        </section>
    );
}
