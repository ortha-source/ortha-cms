import { defineMessages, useIntl } from 'react-intl';
import { GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { RelationItemRow, type RelationItemRowProps } from '../RelationItemRow';

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
 * order. Wraps {@link RelationItemRow} with a grip handle and forwards every
 * display/control prop through; a single relation (one item, no order) renders
 * the plain row instead.
 */
export function SortableRelationItem({
    id,
    ...row
}: RelationItemRowProps & { id: string }) {
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
            {...row}
            rowRef={setNodeRef}
            style={{ transform: CSS.Translate.toString(transform), transition }}
            dragging={isDragging}
            dragHandle={
                <button
                    type="button"
                    className="cursor-grab rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={intl.formatMessage(messages.reorder, {
                        title: row.title
                    })}
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="size-4" aria-hidden />
                </button>
            }
        />
    );
}
