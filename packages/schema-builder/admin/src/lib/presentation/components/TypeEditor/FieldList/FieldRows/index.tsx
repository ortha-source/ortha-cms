import type { FieldEntry } from '@orthacms/schema-builder-domain';
import type { FieldListEditing } from '../fieldListEditing';
import { FieldRow } from '../FieldRow';
import { SortableFieldRows } from './SortableFieldRows';

type Props = { fields: readonly FieldEntry[]; editing?: FieldListEditing };

/** A list of field rows: sortable when editing, a plain list otherwise. */
export function FieldRows({ fields, editing }: Props) {
    if (editing) return <SortableFieldRows fields={fields} editing={editing} />;
    return (
        <ul className="divide-y">
            {fields.map((entry) => (
                <li key={entry.key}>
                    <FieldRow entry={entry} />
                </li>
            ))}
        </ul>
    );
}
