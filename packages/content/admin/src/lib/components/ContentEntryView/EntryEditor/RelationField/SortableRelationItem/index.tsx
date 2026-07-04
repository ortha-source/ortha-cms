import { defineMessages, useIntl } from 'react-intl';
import { GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { RelationItemRow } from '../RelationItemRow';

/** Co-located label for the drag handle. */
const messages = defineMessages({
    reorder: {
        id: 'content.relations.field.reorder',
        defaultMessage: 'Reorder {title}'
    }
});

/**
 * An assigned related record made sortable (drag + keyboard) via dnd-kit — used
 * for a **many**-relation, where the order of links is the field value's array
 * order. Wraps {@link RelationItemRow} with a grip handle; a single relation
 * (one item, no order) renders the plain row instead.
 */
export function SortableRelationItem({
    id,
    title,
    onRemove,
    removeLabel,
    href,
    openLabel
}: {
    id: string;
    title: string;
    onRemove: () => void;
    removeLabel: string;
    /** Deep link to this record's editor (open-in-new-tab control). */
    href?: string;
    /** Accessible label for the open link. */
    openLabel?: string;
}) {
    const intl = useIntl();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    return (
        <RelationItemRow
            title={title}
            onRemove={onRemove}
            removeLabel={removeLabel}
            href={href}
            openLabel={openLabel}
            rowRef={setNodeRef}
            style={{ transform: CSS.Translate.toString(transform), transition }}
            dragging={isDragging}
            handle={
                <button
                    type="button"
                    className="cursor-grab rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={intl.formatMessage(messages.reorder, { title })}
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="size-4" aria-hidden />
                </button>
            }
        />
    );
}
