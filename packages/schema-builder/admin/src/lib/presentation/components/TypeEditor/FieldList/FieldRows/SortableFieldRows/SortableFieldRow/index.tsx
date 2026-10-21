import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { defineMessages, useIntl } from 'react-intl';
import { GripVertical } from 'lucide-react';
import {
    cn,
    dragLiftClassName,
    dragLiftTransition,
    usePrefersReducedMotion
} from '@orthacms/design-system';
import type { FieldEntry } from '@orthacms/schema-builder-domain';
import type { FieldListEditing } from '../../../fieldListEditing';
import type { SortableListData } from '../../../sortableList';
import { FieldRow } from '../../../FieldRow';

const messages = defineMessages({
    reorder: {
        id: 'schemaBuilder.field.reorder',
        defaultMessage: 'Reorder {name}'
    }
});

/**
 * A row that can be dragged — by pointer or, from its handle, by keyboard —
 * within its list or into another list of the same scope.
 */
export function SortableFieldRow({
    entry,
    list,
    editing
}: {
    entry: FieldEntry;
    /** The id of the list it is drawn in. */
    list: string;
    editing: FieldListEditing;
}) {
    const intl = useIntl();
    const data: SortableListData = { list };
    const reducedMotion = usePrefersReducedMotion();
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: entry.key,
        data,
        // dnd-kit's glide is an inline style, out of reach of any
        // `motion-reduce:` class — so it is switched off at the source.
        transition: reducedMotion ? null : undefined
    });
    return (
        <li
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition: dragLiftTransition(transition, reducedMotion)
            }}
            // Picked up while dragged — raised, scaled, above its neighbours.
            className={cn(
                dragLiftClassName(isDragging),
                isDragging && 'bg-card'
            )}
        >
            <FieldRow
                entry={entry}
                editing={editing}
                handle={
                    <button
                        type="button"
                        ref={setActivatorNodeRef}
                        className={cn(
                            'rounded text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            isDragging ? 'cursor-grabbing' : 'cursor-grab'
                        )}
                        aria-label={intl.formatMessage(messages.reorder, {
                            name: entry.name
                        })}
                        {...attributes}
                        {...listeners}
                    >
                        <GripVertical className="size-4" aria-hidden />
                    </button>
                }
            />
        </li>
    );
}
