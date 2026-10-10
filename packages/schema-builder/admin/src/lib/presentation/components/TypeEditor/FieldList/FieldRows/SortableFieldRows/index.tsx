import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import type { FieldListEditing } from '../../fieldListEditing';
import {
    useDrawnFields,
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
 * list is one itself, so a field can still be dragged into it. Mid-drag it is
 * drawn in the scope's order: a field dragged in from another list is already
 * a row here, and the rows around it make room.
 */
export function SortableFieldRows({ list, editing, empty }: Props) {
    const fields = useDrawnFields(list);
    const data: SortableListData = { list: list.id };
    const { setNodeRef } = useDroppable({
        id: list.id,
        data,
        // A list with rows is reached through them; as a target of its own it
        // would compete with them for the drop.
        disabled: fields.length > 0
    });
    return (
        <div ref={setNodeRef}>
            {fields.length === 0 ? (
                empty
            ) : (
                <SortableContext
                    id={list.id}
                    items={fields.map((entry) => entry.key)}
                    strategy={verticalListSortingStrategy}
                >
                    <ul className="divide-y">
                        {fields.map((entry) => (
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
