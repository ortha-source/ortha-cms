import * as React from 'react';

import { cn } from '../../utils';

/**
 * A keyboard-key chip (e.g. `↵`, `esc`, `⌘K`) for shortcut hints in command
 * palettes and menus. Styled for light surfaces; override with sidebar tokens
 * when rendered inside the dark sidebar.
 */
const Kbd = ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <kbd
        className={cn(
            'pointer-events-none inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground',
            className
        )}
        {...props}
    />
);
Kbd.displayName = 'Kbd';

export { Kbd };
