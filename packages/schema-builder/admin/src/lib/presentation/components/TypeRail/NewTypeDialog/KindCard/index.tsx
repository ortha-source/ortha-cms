import type { LucideIcon } from 'lucide-react';
import { cn } from '@orthacms/design-system';

type Props = {
    id: string;
    icon: LucideIcon;
    title: string;
    example: string;
    selected: boolean;
    onSelect: () => void;
};

/** One kind of type as a card: a radio named by its title, described by its example. */
export function KindCard({
    id,
    icon: Icon,
    title,
    example,
    selected,
    onSelect
}: Props) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            aria-labelledby={`${id}-title`}
            aria-describedby={`${id}-example`}
            tabIndex={selected ? 0 : -1}
            data-kind={id}
            onClick={onSelect}
            className={cn(
                'flex items-start gap-3 rounded-lg border bg-card p-3.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                selected
                    ? 'border-foreground ring-1 ring-foreground'
                    : 'hover:bg-accent/60'
            )}
        >
            <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground"
            >
                <Icon className="size-4" />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
                <span id={`${id}-title`} className="text-sm font-medium">
                    {title}
                </span>
                <span
                    id={`${id}-example`}
                    className="text-xs leading-snug text-muted-foreground"
                >
                    {example}
                </span>
            </span>
        </button>
    );
}
