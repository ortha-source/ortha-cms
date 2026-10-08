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

/** The list a dragged row or a drop target belongs to. */
export function listOf(
    node: { data: { current?: Record<string, unknown> } } | null | undefined
): string | undefined {
    const list = node?.data.current?.['list'];
    return typeof list === 'string' ? list : undefined;
}
