import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { defineMessages, useIntl } from 'react-intl';
import { GripVertical } from 'lucide-react';
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
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: entry.key, data });
    return (
        <li
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={
                isDragging ? 'relative z-10 bg-card shadow-md' : undefined
            }
        >
            <FieldRow
                entry={entry}
                editing={editing}
                handle={
                    <button
                        type="button"
                        ref={setActivatorNodeRef}
                        className="cursor-grab rounded text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
