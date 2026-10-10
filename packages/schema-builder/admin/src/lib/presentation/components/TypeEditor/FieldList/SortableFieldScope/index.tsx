import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    MeasuringStrategy,
    PointerSensor,
    useSensor,
    useSensors,
    type Active,
    type Announcements,
    type CollisionDetection,
    type DragEndEvent,
    type DragOverEvent,
    type DragStartEvent,
    type KeyboardCoordinateGetter,
    type Over
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { defineMessages, useIntl } from 'react-intl';
import type { FieldEntry, GroupDoc } from '@orthacms/schema-builder-domain';
import { fieldDrop, type FieldDrop } from '../../../../../domain/fieldDrop';
import type { FieldListEditing } from '../fieldListEditing';
import {
    DragOrderContext,
    groupOf,
    listOf,
    type DragOrder,
    type SortableList
} from '../sortableList';

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
    },
    groupPickedUp: {
        id: 'schemaBuilder.reorder.groupPickedUp',
        defaultMessage: 'Picked up the group {name}.'
    },
    groupOver: {
        id: 'schemaBuilder.reorder.groupOver',
        defaultMessage: 'The group {name} is over the group {target}.'
    },
    groupDropped: {
        id: 'schemaBuilder.reorder.groupDropped',
        defaultMessage: 'Dropped the group {name}.'
    },
    groupCancelled: {
        id: 'schemaBuilder.reorder.groupCancelled',
        defaultMessage: 'Moving the group {name} was cancelled.'
    }
});

type Props = {
    /** Every list a row in this scope may be dropped in. */
    lists: readonly SortableList[];
    /** Groups drawn in this scope, which sort among themselves. */
    groups?: readonly GroupDoc[];
    /** Absent, the lists are read-only and the scope draws them as they are. */
    editing?: FieldListEditing;
    children: ReactNode;
};

type Keys = Record<string, string[]>;
type DndNode = Parameters<typeof listOf>[0];

/** A group is dragged among groups, a field among fields — never across. */
const sameKind = (a: DndNode, b: DndNode) =>
    groupOf(a) !== undefined
        ? groupOf(b) !== undefined
        : listOf(b) !== undefined;

/** Collisions only with drop targets of the dragged thing's kind. */
const closestOfKind: CollisionDetection = (args) =>
    closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((container) =>
            sameKind(args.active, container)
        )
    });

/**
 * One drag-and-drop scope over the lists drawn inside it. General's loose
 * fields and its groups share one, so a field can be dragged into a group and
 * back out — the list it is over makes room for it as it moves, the same as a
 * reorder does — and the groups themselves are dragged into a new order.
 * Relations and Media each have their own scope, since nothing there can join
 * a group. A reorder the entry editor would undo (across ranks) is refused and
 * said so. Announcements name fields, lists and groups, not internal keys.
 */
export function SortableFieldScope({
    lists,
    groups = [],
    editing,
    children
}: Props) {
    const intl = useIntl();
    // The row a field was just put in front of, in another list. The list it
    // left closes up, so that row slides under the field still held there —
    // and being over it would read as "after it". The field stays where it
    // was put until it is dragged past the row's middle, or onto another
    // row; by keyboard, until the next arrow key.
    const pinRef = useRef<string | null>(null);
    const keyboardRef = useRef(false);
    // Keyboard steps, only onto drop targets of the dragged thing's kind.
    // Each one is a deliberate move, so it lets go of the pin.
    const keyboardCoordinates = useCallback<KeyboardCoordinateGetter>(
        (event, args) => {
            const { active, droppableContainers } = args.context;
            const filtered = {
                get: (id: Parameters<typeof droppableContainers.get>[0]) =>
                    droppableContainers.get(id),
                getEnabled: () =>
                    droppableContainers
                        .getEnabled()
                        .filter((container) => sameKind(active, container))
            } as typeof droppableContainers;
            pinRef.current = null;
            return sortableKeyboardCoordinates(event, {
                ...args,
                context: { ...args.context, droppableContainers: filtered }
            });
        },
        []
    );
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates })
    );
    // Mid-drag, the lists as drawn; `null` when no field is dragged. The ref
    // is what handlers read: dnd-kit calls them before a render catches up.
    const [keys, setKeys] = useState<Keys | null>(null);
    const keysRef = useRef<Keys | null>(null);
    const originRef = useRef<string | undefined>(undefined);
    const dropRef = useRef<FieldDrop | null>(null);
    const fields = useMemo(
        () =>
            new Map(
                lists.flatMap((list) =>
                    list.fields.map((entry) => [entry.key, entry] as const)
                )
            ),
        [lists]
    );
    const order = useMemo<DragOrder | null>(
        () => (keys ? { keys, fieldOf: (key) => fields.get(key) } : null),
        [keys, fields]
    );
    // Stable: dnd-kit recomputes collisions whenever this changes.
    const collisions = useCallback<CollisionDetection>((args) => {
        const hits = closestOfKind(args);
        const pinned = pinRef.current;
        if (pinned === null) return hits;
        const first = hits[0]?.id;
        const row = args.droppableRects.get(pinned);
        const middle = (rect: { top: number; height: number }) =>
            rect.top + rect.height / 2;
        // Released once over another row, or dragged past this one's middle
        // — not by keyboard, whose rect is re-based on the field's new slot.
        const released =
            (first !== pinned && first !== args.active.id) ||
            (!keyboardRef.current &&
                row !== undefined &&
                middle(args.collisionRect) > middle(row));
        if (!released) return [{ id: args.active.id }];
        pinRef.current = null;
        return hits;
    }, []);
    if (!editing) return children;

    const draw = (next: Keys | null) => {
        keysRef.current = next;
        setKeys(next);
    };
    const listById = (id: string | undefined) =>
        lists.find((list) => list.id === id);
    const fieldOf = (key: string | number): FieldEntry | undefined =>
        fields.get(String(key));
    const groupLabel = (node: DndNode) =>
        groups.find((group) => group.key === groupOf(node))?.label ?? '';
    const nameOf = (key: string | number) => fieldOf(key)?.name ?? String(key);
    /** The list a field is drawn in now — mid-drag, maybe not where it started. */
    const drawnIn = (key: string | number) => {
        const drawn = keysRef.current;
        if (!drawn) return undefined;
        return Object.keys(drawn).find((id) => drawn[id].includes(String(key)));
    };
    const dropOf = (active: Active, over: Over | null): FieldDrop => {
        const field = fieldOf(active.id);
        const from = listById(originRef.current);
        const id = drawnIn(active.id) ?? listOf(over);
        const list = listById(id);
        if (!over || !field || !from || !list) return { kind: 'none' };
        const drawn = keysRef.current?.[list.id];
        const to = drawn
            ? {
                  ...list,
                  fields: drawn.flatMap((key) => fields.get(key) ?? [])
              }
            : list;
        return fieldDrop(field, from, to, fieldOf(over.id) ?? null);
    };

    const onDragStart = ({ active, activatorEvent }: DragStartEvent) => {
        dropRef.current = null;
        pinRef.current = null;
        // The activator is the native event; a key started this drag.
        keyboardRef.current = activatorEvent.type.startsWith('key');
        originRef.current = listOf(active);
        if (originRef.current === undefined) return;
        draw(
            Object.fromEntries(
                lists.map((list) => [
                    list.id,
                    list.fields.map((entry) => entry.key)
                ])
            )
        );
    };
    // Over a row — or an empty list — of another list, the field moves into
    // it there, so that list's rows make room for it as it is dragged on.
    const onDragOver = ({ active, over }: DragOverEvent) => {
        const drawn = keysRef.current;
        const key = String(active.id);
        const from = drawnIn(key);
        const to = listOf(over);
        // Over itself is where it already is — and its own data may still
        // name the list it just left, which would send it back there.
        if (!drawn || !over || over.id === active.id) return;
        if (!from || !to || from === to) return;
        const target = drawn[to].indexOf(String(over.id));
        const dragged = active.rect.current.translated;
        // Past the middle of the row it is over: after that row.
        const after = Boolean(
            dragged && dragged.top > over.rect.top + over.rect.height / 2
        );
        const at = target < 0 ? drawn[to].length : target + (after ? 1 : 0);
        pinRef.current = target >= 0 && !after ? String(over.id) : null;
        const next = { ...drawn };
        next[from] = drawn[from].filter((entry) => entry !== key);
        next[to] = [...drawn[to].slice(0, at), key, ...drawn[to].slice(at)];
        draw(next);
    };
    const onDragEnd = ({ active, over }: DragEndEvent) => {
        const group = groupOf(active);
        if (group !== undefined) {
            const target = groupOf(over);
            if (target !== undefined && target !== group)
                editing.onMoveGroup(group, target);
            return;
        }
        const key = String(active.id);
        const drop = dropOf(active, over);
        dropRef.current = drop;
        pinRef.current = null;
        draw(null);
        if (drop.kind === 'move') editing.onMove(key, drop.before);
        if (drop.kind === 'regroup')
            editing.onRegroup(key, drop.group, drop.before);
    };

    const announcements: Announcements = {
        onDragStart: ({ active }) =>
            groupOf(active) !== undefined
                ? intl.formatMessage(messages.groupPickedUp, {
                      name: groupLabel(active)
                  })
                : intl.formatMessage(messages.pickedUp, {
                      name: nameOf(active.id)
                  }),
        onDragOver: ({ active, over }) => {
            // Over itself is where it is: nothing to say.
            if (!over || over.id === active.id) return undefined;
            if (groupOf(active) !== undefined)
                return intl.formatMessage(messages.groupOver, {
                    name: groupLabel(active),
                    target: groupLabel(over)
                });
            const name = nameOf(active.id);
            const list = listById(listOf(over));
            const target = fieldOf(over.id);
            if (!target)
                return intl.formatMessage(messages.overList, {
                    name,
                    list: list?.label
                });
            // Named against where it started: that is the move it makes.
            return listOf(over) === originRef.current
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
            if (groupOf(active) !== undefined)
                return intl.formatMessage(messages.groupDropped, {
                    name: groupLabel(active)
                });
            const name = nameOf(active.id);
            const drop = dropRef.current ?? dropOf(active, over);
            if (drop.kind === 'refused')
                return intl.formatMessage(messages.refused, { name });
            if (drop.kind === 'regroup')
                return intl.formatMessage(messages.moved, {
                    name,
                    list: lists.find((list) => list.group === drop.group)?.label
                });
            return intl.formatMessage(messages.dropped, { name });
        },
        onDragCancel: ({ active }) =>
            groupOf(active) !== undefined
                ? intl.formatMessage(messages.groupCancelled, {
                      name: groupLabel(active)
                  })
                : intl.formatMessage(messages.cancelled, {
                      name: nameOf(active.id)
                  })
    };
    return (
        <DndContext
            sensors={sensors}
            collisionDetection={collisions}
            // Rows move between lists mid-drag; measure them as they do.
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDragCancel={() => {
                pinRef.current = null;
                draw(null);
            }}
            accessibility={{
                announcements,
                screenReaderInstructions: {
                    draggable: intl.formatMessage(messages.instructions)
                }
            }}
        >
            <DragOrderContext.Provider value={order}>
                {children}
            </DragOrderContext.Provider>
        </DndContext>
    );
}
