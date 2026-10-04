import type { TypeRule } from '../rule';
import { fieldPath, issue } from '../schema-issue';

/** A field naming a group that does not exist would vanish from the form. */
export const checkGroupRefs: TypeRule = (type) => {
    const keys = new Set(Object.keys(type.groups ?? {}));
    return Object.entries(type.fields)
        .filter(
            ([, field]) =>
                field.group !== undefined &&
                (typeof field.group !== 'string' || !keys.has(field.group))
        )
        .map(([name, field]) =>
            issue(
                fieldPath(type.name, name),
                'group.unknown',
                `Field "${type.name}.${name}" names group ` +
                    `"${String(field.group)}", which "${type.name}" does not declare.`
            )
        );
};
