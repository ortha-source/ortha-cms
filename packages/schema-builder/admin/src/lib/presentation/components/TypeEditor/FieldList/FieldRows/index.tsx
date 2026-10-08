import type { ReactNode } from 'react';
import type { FieldListEditing } from '../fieldListEditing';
import { FieldRow } from '../FieldRow';
import type { SortableList } from '../sortableList';
import { SortableFieldRows } from './SortableFieldRows';

type Props = {
    list: SortableList;
    editing?: FieldListEditing;
    /** What an empty list draws instead of rows. */
    empty?: ReactNode;
};

/**
 * A list of field rows: sortable when editing — inside the
 * `SortableFieldScope` that holds its list — a plain list otherwise.
 */
export function FieldRows({ list, editing, empty }: Props) {
    if (editing)
        return (
            <SortableFieldRows list={list} editing={editing} empty={empty} />
        );
    if (list.fields.length === 0) return empty;
    return (
        <ul className="divide-y">
            {list.fields.map((entry) => (
                <li key={entry.key}>
                    <FieldRow entry={entry} />
                </li>
            ))}
        </ul>
    );
}
