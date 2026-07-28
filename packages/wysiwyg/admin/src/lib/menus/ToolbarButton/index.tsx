import type { ReactNode } from 'react';
import { Button, cn } from '@ortha-cms/design-system';

/**
 * One toggle in the selection toolbar. `aria-pressed` — not a visual state
 * alone — is what tells a screen-reader user whether the selected text is
 * already bold.
 */
export function ToolbarButton({
    label,
    active,
    disabled = false,
    onClick,
    children
}: {
    label: string;
    active: boolean;
    disabled?: boolean;
    onClick(): void;
    children: ReactNode;
}) {
    return (
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
    );
}
