import type { CSSProperties, ReactNode, Ref } from 'react';
import { X } from 'lucide-react';
import { Button } from '@ortha-cms/design-system';

/** First character of a title, for the row avatar. */
function initial(title: string): string {
    return title.trim().charAt(0).toUpperCase() || '·';
}

/**
 * One assigned related record in a {@link RelationField}: an avatar initial, its
 * display title, and a remove button — plus an optional drag `handle` (supplied
 * by the sortable wrapper for a many-relation). Presentational and controlled —
 * the parent owns the value and handles `onRemove`.
 */
export function RelationItemRow({
    title,
    onRemove,
    removeLabel,
    handle,
    rowRef,
    style,
    dragging = false
}: {
    title: string;
    onRemove: () => void;
    /** Accessible label for the remove button (e.g. "Remove Ada Lovelace"). */
    removeLabel: string;
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
            <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
            >
                {initial(title)}
            </span>
            <p className="min-w-0 flex-1 truncate text-sm font-medium">
                {title}
            </p>
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
