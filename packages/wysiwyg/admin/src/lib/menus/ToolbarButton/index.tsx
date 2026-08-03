import type { ReactNode } from 'react';
import {
    Button,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    cn
} from '@ortha-cms/design-system';

/**
 * One toggle in a toolbar. `aria-pressed` — not a visual state alone — is what
 * tells a screen-reader user whether the selected text is already bold.
 *
 * Every one of these is an **icon**, so it also carries a tooltip: the icon is
 * the entire label, and a row of fourteen glyphs is unreadable until you can
 * point at one and be told what it does. The tooltip shows the same string as
 * the accessible name, so the two cannot drift apart.
 */
export function ToolbarButton({
    label,
    active,
    disabled = false,
    shortcut,
    onClick,
    children
}: {
    label: string;
    active: boolean;
    disabled?: boolean;
    /** Shown beside the label — the cheapest way to learn a shortcut. */
    shortcut?: string;
    onClick(): void;
    children: ReactNode;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={label}
                    aria-pressed={active}
                    disabled={disabled}
                    className={cn(
                        'size-7',
                        active && 'bg-accent text-accent-foreground'
                    )}
                    onClick={onClick}
                >
                    {children}
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                {label}
                {shortcut ? (
                    <span className="text-muted-foreground ml-2">
                        {shortcut}
                    </span>
                ) : null}
            </TooltipContent>
        </Tooltip>
    );
}
