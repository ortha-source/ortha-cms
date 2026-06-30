import * as React from 'react';
import { cn } from '../../utils';

/**
 * Root container for the top navigation bar. Renders a sticky, light header
 * (theme tokens, so it follows light/dark mode) with a bottom border.
 */
function Navbar({ className, ...props }: React.ComponentProps<'header'>) {
    return (
        <header
            className={cn(
                'sticky top-0 z-50 flex h-12 items-center gap-2 border-b border-border bg-background px-3 text-foreground',
                className
            )}
            {...props}
        />
    );
}

/** Brand section of the navbar, typically holds the logo. */
function NavbarBrand({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            className={cn('flex shrink-0 items-center', className)}
            {...props}
        />
    );
}

/** Navigation section holding {@link navbarItemVariants} entries. */
function NavbarNav({ className, ...props }: React.ComponentProps<'nav'>) {
    return (
        <nav className={cn('flex items-center gap-3', className)} {...props} />
    );
}

/**
 * Returns the Tailwind classes for a navbar navigation item. Pass `active` for
 * the selected state. Use with a router link or a plain `<button>`.
 */
function navbarItemVariants(active?: boolean) {
    return cn(
        'inline-flex size-8 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-all',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        active && 'bg-accent text-accent-foreground'
    );
}

/** Flexible spacer that pushes subsequent content to the end of the bar. */
function NavbarSpacer({ className, ...props }: React.ComponentProps<'div'>) {
    return <div className={cn('flex-1', className)} {...props} />;
}

/** Trailing section of the navbar (e.g. account menu), at the far right. */
function NavbarEnd({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div className={cn('flex items-center gap-2', className)} {...props} />
    );
}

export {
    Navbar,
    NavbarBrand,
    NavbarNav,
    navbarItemVariants,
    NavbarSpacer,
    NavbarEnd
};
