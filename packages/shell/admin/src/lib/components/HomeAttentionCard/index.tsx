import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '@orthacms/design-system';

/**
 * How loud a {@link HomeAttentionCard} is: broken, waiting, a heads-up, or
 * `calm` — a queue that is empty right now, said as "0" so its absence is
 * not mistaken for a card that failed to load.
 */
export type HomeAttentionTone = 'destructive' | 'warning' | 'info' | 'calm';

const TONE: Record<HomeAttentionTone, string> = {
    destructive: 'bg-destructive-soft text-destructive-soft-foreground',
    warning: 'bg-warning-soft text-warning-soft-foreground',
    info: 'bg-info-soft text-info-soft-foreground',
    calm: 'bg-muted text-muted-foreground'
};

/**
 * One card under the home dashboard's "Needs your attention": a tinted icon
 * tile, a short headline that states the count ("1 webhook stopped"), one
 * sentence of why, and the way to deal with it.
 *
 * The whole card is the link — one tab stop, named by its headline and its
 * call to action — so a grid of four is four stops, not twelve. A plugin
 * contributing to the `attention` region renders this or `null`.
 */
export function HomeAttentionCard({
    tone,
    icon: Icon,
    title,
    description,
    action,
    to
}: {
    tone: HomeAttentionTone;
    icon: ComponentType<{ className?: string }>;
    /** The headline, with its count: "3 entries await review". */
    title: string;
    /** One sentence of context. */
    description: string;
    /** The call to action: "Open webhook". */
    action: string;
    /** Where the card leads. */
    to: string;
}) {
    return (
        <Link
            to={to}
            className="flex flex-col gap-2.5 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            <span
                aria-hidden
                className={cn(
                    'inline-flex size-8 items-center justify-center rounded-[9px]',
                    TONE[tone]
                )}
            >
                <Icon className="size-4" />
            </span>
            <span className="text-[15px] font-semibold leading-5">{title}</span>
            <span className="text-[13px] leading-[18px] text-muted-foreground">
                {description}
            </span>
            <span className="mt-auto flex items-center gap-1 pt-1 text-[13px] font-medium">
                {action}
                <ArrowRight className="size-3.5" aria-hidden />
            </span>
        </Link>
    );
}
