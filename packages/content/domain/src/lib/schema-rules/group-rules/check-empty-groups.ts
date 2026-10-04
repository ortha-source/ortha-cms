import type { TypeRule } from '../rule';
import { groupPath, issue } from '../schema-issue';

/** A group no field joins would render as an empty fold. */
export const checkEmptyGroups: TypeRule = (type) => {
    const used = new Set(
        Object.values(type.fields).map((field) => field.group)
    );
    return Object.keys(type.groups ?? {})
        .filter((key) => !used.has(key))
        .map((key) =>
            issue(
                groupPath(type.name, key),
                'group.empty',
                `Group "${type.name}.${key}" has no fields — ` +
                    `set admin.group on at least one field, or remove it.`
            )
        );
};
