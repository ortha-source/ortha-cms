import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type Announcements,
    type DragEndEvent
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { defineMessages, useIntl } from 'react-intl';
import type { FieldEntry } from '@orthacms/schema-builder-domain';
import { canMoveField } from '../../../../../../domain/canMoveField';
import type { FieldListEditing } from '../../fieldListEditing';
import { SortableFieldRow } from './SortableFieldRow';

const messages = defineMessages({
    instructions: {
        id: 'schemaBuilder.reorder.instructions',
        defaultMessage:
            'Press space to pick up a field, the arrow keys to move it, space again to drop it, escape to cancel.'
    },
    pickedUp: {
        id: 'schemaBuilder.reorder.pickedUp',
        defaultMessage: 'Picked up {name}.'
    },
    over: {
        id: 'schemaBuilder.reorder.over',
        defaultMessage: '{name} is over {target}.'
    },
    dropped: {
        id: 'schemaBuilder.reorder.dropped',
        defaultMessage: 'Dropped {name}.'
    },
    refused: {
        id: 'schemaBuilder.reorder.refused',
        defaultMessage:
            '{name} stays where it is: the form orders fields of different kinds itself.'
    },
    cancelled: {
        id: 'schemaBuilder.reorder.cancelled',
        defaultMessage: 'Moving {name} was cancelled.'
    }
});

type Props = { fields: readonly FieldEntry[]; editing: FieldListEditing };

/**
 * One list of fields the person can reorder. Each list — the loose fields,
 * each group, Relations, Media — is its own context, so a field never leaves
 * its list; a drop the entry editor would undo (across ranks) is refused and
 * said so. Announcements name fields, not internal keys.
 */
export function SortableFieldRows({ fields, editing }: Props) {
    const intl = useIntl();
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates
        })
    );
    const byKey = (key: string | number | undefined) =>
        fields.find((entry) => entry.key === key);
    const nameOf = (key: string | number | undefined) =>
        byKey(key)?.name ?? String(key);
    const allowed = (
        from: string | number,
        to: string | number | undefined
    ) => {
        const field = byKey(from);
        const target = byKey(to);
        return Boolean(field && target && canMoveField(field, target));
    };
    const announcements: Announcements = {
        onDragStart: ({ active }) =>
            intl.formatMessage(messages.pickedUp, { name: nameOf(active.id) }),
        onDragOver: ({ active, over }) =>
            // Over itself is where it started: nothing to say.
            over && over.id !== active.id
                ? intl.formatMessage(messages.over, {
                      name: nameOf(active.id),
                      target: nameOf(over.id)
                  })
                : undefined,
        onDragEnd: ({ active, over }) =>
            !over || active.id === over.id || allowed(active.id, over.id)
                ? intl.formatMessage(messages.dropped, {
                      name: nameOf(active.id)
                  })
                : intl.formatMessage(messages.refused, {
                      name: nameOf(active.id)
                  }),
        onDragCancel: ({ active }) =>
            intl.formatMessage(messages.cancelled, { name: nameOf(active.id) })
    };
    const onDragEnd = ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id || !allowed(active.id, over.id))
            return;
        editing.onMove(String(active.id), String(over.id));
    };
    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
            accessibility={{
                announcements,
                screenReaderInstructions: {
                    draggable: intl.formatMessage(messages.instructions)
                }
            }}
        >
            <SortableContext
                items={fields.map((entry) => entry.key)}
                strategy={verticalListSortingStrategy}
            >
                <ul className="divide-y">
                    {fields.map((entry) => (
                        <SortableFieldRow
                            key={entry.key}
                            entry={entry}
                            editing={editing}
                        />
                    ))}
                </ul>
            </SortableContext>
        </DndContext>
    );
}
