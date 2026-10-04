import { mainColumnName } from '../column-name';
import { RESERVED_COLUMNS } from '../reserved-columns';
import type { FieldRule } from '../rule';
import { fieldPath, issue } from '../schema-issue';

/** No field lands in an envelope column, and no two fields share a column. */
export const checkColumn: FieldRule = (type, name, field, pass) => {
    const column = mainColumnName(name, field);
    if (column === null) return [];
    const path = fieldPath(type.name, name);

    if (RESERVED_COLUMNS.has(column)) {
        return [
            issue(
                path,
                'field.reserved-column',
                `Field "${name}" on "${type.name}" maps to column "${column}", ` +
                    `which collides with an envelope column.`
            )
        ];
    }
    const existing = pass.columns.get(column);
    if (existing) {
        return [
            issue(
                path,
                'field.column-collision',
                `Fields "${existing}" and "${name}" on "${type.name}" both map to ` +
                    `column "${column}".`
            )
        ];
    }
    pass.columns.set(column, name);
    return [];
};
