import type { ComponentType } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@orthacms/design-system';

/** Props for {@link SettingsNavItem}. */
export type SettingsNavItemProps = {
    /** Absolute route the entry links to. */
    to: string;
    /** Leading icon. */
    icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
    /** Localized label. */
    label: string;
    /** A count after the label (content types, members). */
    count?: number;
    /** The Danger zone's red entry. */
    destructive?: boolean;
};

/**
 * One row of the settings side nav: icon, label, an optional count. The open
 * section is the `NavLink`'s `aria-current="page"`, which is also what draws
 * it — so the mark and what a screen reader hears cannot disagree.
 */
export function SettingsNavItem({
    to,
    icon: Icon,
    label,
    count,
    destructive = false
}: SettingsNavItemProps) {
    return (
        <NavLink
            to={to}
            className={cn(
                'flex h-[30px] shrink-0 items-center gap-2.5 whitespace-nowrap rounded-md px-2.5 text-[13px] outline-none transition-colors',
                'hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring',
                'aria-[current=page]:bg-muted aria-[current=page]:font-medium',
                destructive
                    ? 'text-destructive'
                    : 'text-muted-foreground hover:text-foreground aria-[current=page]:text-foreground'
            )}
        >
            <Icon aria-hidden className="size-4 shrink-0" />
            {label}
            {count !== undefined ? (
                <span className="ml-auto pl-3 text-xs font-normal tabular-nums text-muted-foreground">
                    {count}
                </span>
            ) : null}
        </NavLink>
    );
}
