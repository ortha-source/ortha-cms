import type { ReactNode } from 'react';
import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type Active,
    type Announcements,
    type DragEndEvent,
    type Over
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { defineMessages, useIntl } from 'react-intl';
import { fieldDrop, type FieldDrop } from '../../../../../domain/fieldDrop';
import type { FieldListEditing } from '../fieldListEditing';
import { listOf, type SortableList } from '../sortableList';

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
    overIn: {
        id: 'schemaBuilder.reorder.overIn',
        defaultMessage: '{name} is over {target}, in {list}.'
    },
    overList: {
        id: 'schemaBuilder.reorder.overList',
        defaultMessage: '{name} is over {list}.'
    },
    dropped: {
        id: 'schemaBuilder.reorder.dropped',
        defaultMessage: 'Dropped {name}.'
    },
    moved: {
        id: 'schemaBuilder.reorder.moved',
        defaultMessage: 'Moved {name} to {list}.'
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

type Props = {
    /** Every list a row in this scope may be dropped in. */
    lists: readonly SortableList[];
    /** Absent, the lists are read-only and the scope draws them as they are. */
    editing?: FieldListEditing;
    children: ReactNode;
};

/**
 * One drag-and-drop scope over the lists drawn inside it. General's loose
 * fields and its groups share one, so a field can be dragged into a group and
 * back out; Relations and Media each have their own, since nothing there can
 * join a group. A reorder the entry editor would undo (across ranks) is
 * refused and said so. Announcements name fields and lists, not internal keys.
 */
export function SortableFieldScope({ lists, editing, children }: Props) {
    const intl = useIntl();
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates
        })
    );
    if (!editing) return children;

    const listById = (id: string | undefined) =>
        lists.find((list) => list.id === id);
    const fieldOf = (key: string | number) =>
        lists.flatMap((list) => list.fields).find((entry) => entry.key === key);
    const nameOf = (key: string | number) => fieldOf(key)?.name ?? String(key);
    const dropOf = (active: Active, over: Over | null): FieldDrop => {
        const field = fieldOf(active.id);
        const from = listById(listOf(active));
        const to = listById(listOf(over));
        if (!over || !field || !from || !to) return { kind: 'none' };
        // Dropped on the lower half of a row: after it.
        const dragged = active.rect.current.translated;
        const after = Boolean(
            dragged && dragged.top > over.rect.top + over.rect.height / 2
        );
        return fieldDrop(field, from, to, fieldOf(over.id) ?? null, after);
    };
    const announcements: Announcements = {
        onDragStart: ({ active }) =>
            intl.formatMessage(messages.pickedUp, { name: nameOf(active.id) }),
        onDragOver: ({ active, over }) => {
            // Over itself is where it started: nothing to say.
            if (!over || over.id === active.id) return undefined;
            const name = nameOf(active.id);
            const list = listById(listOf(over));
            const target = fieldOf(over.id);
            if (!target)
                return intl.formatMessage(messages.overList, {
                    name,
                    list: list?.label
                });
            return listOf(over) === listOf(active)
                ? intl.formatMessage(messages.over, {
                      name,
                      target: target.name
                  })
                : intl.formatMessage(messages.overIn, {
                      name,
                      target: target.name,
                      list: list?.label
                  });
        },
        onDragEnd: ({ active, over }) => {
            const name = nameOf(active.id);
            const drop = dropOf(active, over);
            if (drop.kind === 'refused')
                return intl.formatMessage(messages.refused, { name });
            if (drop.kind === 'regroup')
                return intl.formatMessage(messages.moved, {
                    name,
                    list: listById(listOf(over))?.label
                });
            return intl.formatMessage(messages.dropped, { name });
        },
        onDragCancel: ({ active }) =>
            intl.formatMessage(messages.cancelled, { name: nameOf(active.id) })
    };
    const onDragEnd = ({ active, over }: DragEndEvent) => {
        const key = String(active.id);
        const drop = dropOf(active, over);
        if (drop.kind === 'move') editing.onMove(key, drop.before);
        if (drop.kind === 'regroup')
            editing.onRegroup(key, drop.group, drop.before);
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
            {children}
        </DndContext>
    );
}
