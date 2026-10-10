import { createContext, useContext } from 'react';
import type { FieldEntry } from '@orthacms/schema-builder-domain';
import type { FieldDropList } from '../../../../domain/fieldDrop';

/**
 * One list of field rows inside a sortable scope: the loose fields above the
 * groups, one group, Relations or Media. `id` is what dnd-kit knows the list
 * by; `label` is how an announcement names it.
 */
export type SortableList = FieldDropList & {
    readonly id: string;
    readonly label: string;
};

/** What a row or a list registers with dnd-kit, so a drop knows its list. */
export type SortableListData = { readonly list: string };

/** What a group block registers with dnd-kit: groups sort among themselves. */
export type SortableGroupData = { readonly group: string };

/** The id a group block is sorted by — never a field key, never a list id. */
export function groupSortId(key: string): string {
    return `group:${key}`;
}

type DndNode =
    | { data: { current?: Record<string, unknown> } }
    | null
    | undefined;

/** The list a dragged row or a drop target belongs to. */
export function listOf(node: DndNode): string | undefined {
    const list = node?.data.current?.['list'];
    return typeof list === 'string' ? list : undefined;
}

/** The key of the group a dragged block or a drop target is. */
export function groupOf(node: DndNode): string | undefined {
    const group = node?.data.current?.['group'];
    return typeof group === 'string' ? group : undefined;
}

/**
 * While a field is dragged, the lists as its scope draws them — field keys by
 * list id, the dragged field already in the list it is over — so the rows
 * there make room for it instead of the list only lighting up.
 */
export type DragOrder = {
    readonly keys: Readonly<Record<string, readonly string[]>>;
    readonly fieldOf: (key: string) => FieldEntry | undefined;
};

export const DragOrderContext = createContext<DragOrder | null>(null);

/** A list's fields as drawn: mid-drag in the scope's order, else as given. */
export function useDrawnFields(list: SortableList): readonly FieldEntry[] {
    const order = useContext(DragOrderContext);
    const keys = order?.keys[list.id];
    if (!order || !keys) return list.fields;
    return keys.flatMap((key) => {
        const entry = order.fieldOf(key);
        return entry ? [entry] : [];
    });
}
