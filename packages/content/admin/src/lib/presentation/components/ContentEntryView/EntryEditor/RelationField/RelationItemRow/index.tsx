import type { CSSProperties, ReactNode, Ref } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ChevronDown, ChevronUp, ExternalLink, X } from 'lucide-react';
import {
    Badge,
    Button,
    buttonVariants,
    cn,
    dragLiftClassName
} from '@orthacms/design-system';
import type {
    EntrySource,
    EntryStatus
} from '../../../../../../domain/types/contentType';
import { ENTRY_STATUS } from '../../../../../../domain/constants';
import { SharedSourceBadge } from '../../../../SharedSourceBadge';
import { TrashedBadge } from '../../../../TrashedBadge';

/** Co-located labels for the row's status badge and the Replace control. */
const messages = defineMessages({
    statusDraft: {
        id: 'content.relations.row.statusDraft',
        defaultMessage: 'Draft'
    },
    statusPublished: {
        id: 'content.relations.row.statusPublished',
        defaultMessage: 'Published'
    },
    replace: {
        id: 'content.relations.row.replace',
        defaultMessage: 'Replace'
    },
    unavailable: {
        id: 'content.relations.row.unavailable',
        defaultMessage: 'Unavailable record'
    }
});

/**
 * One assigned related record in the Relations tab — the shared row for a single
 * relation, a many-relation, and the inverse side. Renders a **leading** slot
 * (an initials avatar for a single relation, a `01`/`02` index for an ordered
 * many-relation, or nothing), the title with a muted `/handle`, an optional
 * status badge, and a trailing controls cluster: reorder **up/down** arrows
 * (ordered relations), the drag `handle`, an **open-in-new-tab** link, a
 * **Replace** action (single relation), and remove. Presentational and
 * controlled — the parent owns the value and every callback. Accessible names
 * for the controls are passed in so the parent can interpolate the record title.
 *
 * In a **read-only** editor every write control is dropped rather than disabled
 * — reorder arrows, drag handle, Replace, remove — because there is no state in
 * which they would light up for this reader, and a row of five dead buttons
 * reads as a broken editor rather than a preview. The open-in-a-new-tab link
 * stays: following a link to a record you can read is not a write.
 */
export type RelationItemRowProps = {
    title: string;
    /** URL-ish handle rendered as a muted `/handle` beside the title. */
    handle?: string;
    /** Publish status of the linked record — renders a badge when present. */
    status?: EntryStatus;
    /**
     * The shared workspace the linked record lives in — renders a
     * "Shared · {workspace}" badge. `null`/absent for the open workspace's own.
     * The row's open link still points into the **open** workspace, which
     * shows a shared record read-only.
     */
    source?: EntrySource | null;
    /**
     * The linked record is in the trash — the title stays (it is the real one)
     * and an "In trash" mark replaces the status badge and the open link, since
     * the editor cannot open a trashed record.
     */
    trashed?: boolean;
    /**
     * The target could not be resolved at all — the server sent the id as the
     * title, so the row reads "Unavailable record" instead and offers no link.
     */
    missing?: boolean;
    /** Leading visual: an initials avatar (single) or an index chip (many). */
    leading?: ReactNode;
    onRemove: () => void;
    /** Accessible label for the remove button (e.g. "Remove Ada Lovelace"). */
    removeLabel: string;
    /** Deep link to this record's editor; renders an open-in-new-tab control. */
    href?: string;
    /** Accessible label for the open link (e.g. "Open Ada Lovelace in a new tab"). */
    openLabel?: string;
    /** Swap this single-relation link for another (opens the picker). */
    onReplace?: () => void;
    /** Move this row up one place (ordered many-relations only). */
    onMoveUp?: () => void;
    /** Accessible label for the up arrow (e.g. "Move Ada Lovelace up"). */
    moveUpLabel?: string;
    /** Disable the up arrow (the first row). */
    moveUpDisabled?: boolean;
    /** Move this row down one place (ordered many-relations only). */
    onMoveDown?: () => void;
    /** Accessible label for the down arrow (e.g. "Move Ada Lovelace down"). */
    moveDownLabel?: string;
    /** Disable the down arrow (the last row). */
    moveDownDisabled?: boolean;
    /** Drag handle, when the row is reorderable (many-relations only). */
    dragHandle?: ReactNode;
    /** dnd-kit node ref for the sortable wrapper. */
    rowRef?: Ref<HTMLDivElement>;
    /** dnd-kit transform/transition styles while dragging. */
    style?: CSSProperties;
    /** Whether this row is the one being dragged (lifts it — raised, scaled). */
    dragging?: boolean;
    /** Extra classes for the row (the field's just-added entrance). */
    className?: string;
    /**
     * Preview mode — drop every write control (reorder, drag, Replace, remove)
     * and keep the record's identity and its open-in-a-new-tab link.
     */
    readOnly?: boolean;
    /**
     * `card` — a framed row of its own (a single relation's one record).
     * `list` — one line of a framed list, ruled from the line above (a many
     * relation's records, the list drawing the frame).
     */
    variant?: 'card' | 'list';
};

export function RelationItemRow({
    title,
    handle,
    status,
    source,
    trashed = false,
    missing = false,
    leading,
    onRemove,
    removeLabel,
    href,
    openLabel,
    onReplace,
    onMoveUp,
    moveUpLabel,
    moveUpDisabled = false,
    onMoveDown,
    moveDownLabel,
    moveDownDisabled = false,
    dragHandle,
    rowRef,
    style,
    dragging = false,
    readOnly = false,
    variant = 'card',
    className
}: RelationItemRowProps) {
    const intl = useIntl();
    const iconButton = cn(
        buttonVariants({ variant: 'ghost', size: 'icon' }),
        'size-7 shrink-0 text-muted-foreground hover:text-foreground'
    );

    return (
        <div
            ref={rowRef}
            style={style}
            className={cn(
                'group/row flex items-center gap-2.5',
                variant === 'list'
                    ? 'h-11 border-t bg-background pl-3 pr-2 first:border-t-0 hover:bg-muted/40'
                    : 'rounded-[10px] border bg-background py-2 pl-3 pr-2 shadow-xs',
                // The row *is* what moves (no drag overlay), so it is lifted,
                // not dimmed — a faded row reads as the gap it left behind.
                // Carries the colour transition `transition-colors` gave it.
                dragLiftClassName(dragging),
                className
            )}
        >
            {readOnly ? null : (dragHandle ?? null)}
            {leading ?? null}
            <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
                {missing ? (
                    <span className="truncate text-sm italic text-muted-foreground">
                        {intl.formatMessage(messages.unavailable)}
                    </span>
                ) : (
                    <span
                        className={cn(
                            'min-w-0 truncate text-sm font-medium',
                            trashed ? 'text-muted-foreground' : ''
                        )}
                    >
                        {title}
                    </span>
                )}
                {handle && !missing ? (
                    // The title comes first; the slug gives up its width
                    // long before the title does.
                    <span className="min-w-0 shrink-[8] truncate font-mono text-xs text-muted-foreground">
                        /{handle}
                    </span>
                ) : null}
            </div>
            <SharedSourceBadge source={source} />
            {trashed ? <TrashedBadge /> : null}
            {status && !trashed && !missing ? (
                <Badge
                    variant={
                        status === ENTRY_STATUS.Published ? 'success' : 'muted'
                    }
                    size="xs"
                    className="shrink-0"
                >
                    {intl.formatMessage(
                        status === ENTRY_STATUS.Published
                            ? messages.statusPublished
                            : messages.statusDraft
                    )}
                </Badge>
            ) : null}
            {/* The row's actions show on hover and on focus anywhere in the
                row — always, on a device that cannot hover. Faded, not
                removed: they stay in the tab order and the a11y tree. */}
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 [@media(hover:none)]:opacity-100">
                {onMoveUp && !readOnly ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                        aria-label={moveUpLabel}
                        disabled={moveUpDisabled}
                        onClick={onMoveUp}
                    >
                        <ChevronUp className="size-4" aria-hidden />
                    </Button>
                ) : null}
                {onMoveDown && !readOnly ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                        aria-label={moveDownLabel}
                        disabled={moveDownDisabled}
                        onClick={onMoveDown}
                    >
                        <ChevronDown className="size-4" aria-hidden />
                    </Button>
                ) : null}
                {href && !trashed && !missing ? (
                    <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className={iconButton}
                        aria-label={openLabel}
                    >
                        <ExternalLink className="size-4" aria-hidden />
                    </a>
                ) : null}
                {onReplace && !readOnly ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={onReplace}
                    >
                        {intl.formatMessage(messages.replace)}
                    </Button>
                ) : null}
                {readOnly ? null : (
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
                )}
            </div>
        </div>
    );
}
