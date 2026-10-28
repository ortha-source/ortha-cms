import type { ComponentType } from 'react';
import { badgeVariants, cn } from '@orthacms/design-system';

/**
 * How loud a navigation count is. `info` for work that is waiting on the
 * reader, `warning` / `destructive` for problems by severity, `strong` for a
 * total that is not about one kind of thing (the inbox's unread count).
 */
export type NavBadgeTone = 'info' | 'warning' | 'destructive' | 'strong';

/**
 * A count a plugin attaches to a navigation row, through a `useBadge` hook on
 * the row's slot item.
 *
 * The plugin reports, the navigation draws: one chip shape, one place it sits,
 * one way it reaches a screen reader. That is the same split as the editor's
 * `ENTRY_STATUS_ITEM_SLOT` — a contributor never renders its own chip into a
 * row it does not own.
 */
export type NavBadge = {
    /** The number shown. Never 0 — a hook with nothing to say returns `null`. */
    count: number;
    tone: NavBadgeTone;
    /**
     * The whole fact in words, already translated ("3 reviews waiting on
     * you"). It is appended to the link's accessible name, because the chip is
     * decoration: colour and a bare digit are not information.
     */
    label: string;
    /** An optional glyph, so two chips on one row differ by shape too. */
    icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
};

/** A badge hook with nothing to say — the stand-in for an item without one. */
export function useNoBadge(): NavBadge | null {
    return null;
}

const VARIANT: Record<
    NavBadgeTone,
    'info' | 'warning' | 'destructive-soft' | 'default'
> = {
    info: 'info',
    warning: 'warning',
    destructive: 'destructive-soft',
    strong: 'default'
};

/** The sentence a row appends to its link name, or `null` with no badges. */
export function navBadgeText(badges: readonly NavBadge[]): string | null {
    return badges.length > 0
        ? badges.map((badge) => badge.label).join(', ')
        : null;
}

/** Shows `99+` past two digits: a navigation chip is a glance, not a report. */
function display(count: number): string {
    return count > 99 ? '99+' : String(count);
}

type NavBadgesProps = {
    badges: readonly NavBadge[];
    className?: string;
};

/**
 * The chips at the end of a sidebar row. A **sibling** of the row's button,
 * not a child of its link — `SidebarMenuButton` truncates its last `<span>`,
 * and a chip inside the link would take the truncation away from the label —
 * and `aria-hidden`, since {@link navBadgeText} carries the same fact inside
 * the link where a screen reader meets it.
 */
export function NavBadges({ badges, className }: NavBadgesProps) {
    if (badges.length === 0) {
        return null;
    }
    return (
        <div
            aria-hidden
            data-sidebar="menu-badge"
            className={cn(
                'pointer-events-none absolute top-1.5 right-1 flex items-center gap-1 group-data-[collapsible=icon]:hidden',
                className
            )}
        >
            {badges.map((badge, index) => {
                const Icon = badge.icon;
                return (
                    <span
                        key={index}
                        className={cn(
                            badgeVariants({
                                variant: VARIANT[badge.tone],
                                size: 'xs'
                            }),
                            'rounded-full tabular-nums'
                        )}
                    >
                        {Icon ? (
                            <Icon className="size-2.5" aria-hidden />
                        ) : null}
                        {display(badge.count)}
                    </span>
                );
            })}
        </div>
    );
}
