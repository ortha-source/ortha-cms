import type { CSSProperties, ReactNode, Ref } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { Button, buttonVariants, cn } from '@ortha-cms/design-system';

/**
 * One assigned related record in a {@link RelationField}: its display title, an
 * optional "open in a new tab" link, and a remove button — plus an optional drag
 * `handle` (supplied by the sortable wrapper for a many-relation).
 * Presentational and controlled — the parent owns the value and handles
 * `onRemove`.
 */
export function RelationItemRow({
    title,
    onRemove,
    removeLabel,
    href,
    openLabel,
    handle,
    rowRef,
    style,
    dragging = false
}: {
    title: string;
    onRemove: () => void;
    /** Accessible label for the remove button (e.g. "Remove Ada Lovelace"). */
    removeLabel: string;
    /** Deep link to this record's editor; renders an open-in-new-tab control. */
    href?: string;
    /** Accessible label for the open link (e.g. "Open Ada Lovelace in a new tab"). */
    openLabel?: string;
    /** Drag handle, when the row is reorderable (many-relations only). */
    handle?: ReactNode;
    /** dnd-kit node ref for the sortable wrapper. */
    rowRef?: Ref<HTMLDivElement>;
    /** dnd-kit transform/transition styles while dragging. */
    style?: CSSProperties;
    /** Whether this row is the one being dragged (dims it). */
    dragging?: boolean;
}) {
    return (
        <div
            ref={rowRef}
            style={style}
            className={`flex items-center gap-2.5 rounded-lg border bg-card px-2.5 py-2 transition-colors hover:border-border/80 ${
                dragging ? 'opacity-60 shadow-sm' : ''
            }`}
        >
            {handle ?? null}
            <p className="min-w-0 flex-1 truncate text-sm font-medium">
                {title}
            </p>
            {href ? (
                <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                        buttonVariants({ variant: 'ghost', size: 'icon' }),
                        'size-7 shrink-0 text-muted-foreground hover:text-foreground'
                    )}
                    aria-label={openLabel}
                >
                    <ExternalLink className="size-4" aria-hidden />
                </a>
            ) : null}
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={removeLabel}
                onClick={onRemove}
            >
                <X className="size-4" />
            </Button>
        </div>
    );
}
