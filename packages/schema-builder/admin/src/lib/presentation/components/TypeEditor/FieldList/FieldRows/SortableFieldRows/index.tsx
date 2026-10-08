import type { ReactNode } from 'react';
import { useDndContext, useDroppable } from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { cn } from '@orthacms/design-system';
import type { FieldListEditing } from '../../fieldListEditing';
import {
    listOf,
    type SortableList,
    type SortableListData
} from '../../sortableList';
import { SortableFieldRow } from './SortableFieldRow';

type Props = {
    list: SortableList;
    editing: FieldListEditing;
    /** Drawn — and dropped on — when the list has no fields. */
    empty?: ReactNode;
};

/**
 * One list of a `SortableFieldScope`. Its rows are the drop targets; an empty
 * list is one itself, so a field can still be dragged into it. A field
 * dragged in from another list lights the list up.
 */
export function SortableFieldRows({ list, editing, empty }: Props) {
    const data: SortableListData = { list: list.id };
    const { setNodeRef } = useDroppable({
        id: list.id,
        data,
        // A list with rows is reached through them; as a target of its own it
        // would compete with them for the drop.
        disabled: list.fields.length > 0
    });
    const { active, over } = useDndContext();
    const incoming =
        active !== null &&
        listOf(over) === list.id &&
        listOf(active) !== list.id;
    return (
        <div
            ref={setNodeRef}
            data-drop-target={incoming || undefined}
            className={cn(
                'transition-colors',
                incoming && 'bg-accent/60 ring-2 ring-inset ring-ring'
            )}
        >
            {list.fields.length === 0 ? (
                empty
            ) : (
                <SortableContext
                    id={list.id}
                    items={list.fields.map((entry) => entry.key)}
                    strategy={verticalListSortingStrategy}
                >
                    <ul className="divide-y">
                        {list.fields.map((entry) => (
                            <SortableFieldRow
                                key={entry.key}
                                entry={entry}
                                list={list.id}
                                editing={editing}
                            />
                        ))}
                    </ul>
                </SortableContext>
            )}
        </div>
    );
}
