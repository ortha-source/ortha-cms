import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { defineMessages, useIntl } from 'react-intl';
import { GripVertical } from 'lucide-react';
import type { FieldEntry } from '@orthacms/schema-builder-domain';
import type { FieldListEditing } from '../../../fieldListEditing';
import { FieldRow } from '../../../FieldRow';

const messages = defineMessages({
    reorder: {
        id: 'schemaBuilder.field.reorder',
        defaultMessage: 'Reorder {name}'
    }
});

/** A row the list can reorder, by pointer or — from its handle — by keyboard. */
export function SortableFieldRow({
    entry,
    editing
}: {
    entry: FieldEntry;
    editing: FieldListEditing;
}) {
    const intl = useIntl();
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: entry.key });
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
