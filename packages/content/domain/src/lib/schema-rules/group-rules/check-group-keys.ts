import type { TypeRule } from '../rule';
import { groupPath, issue, type SchemaIssue } from '../schema-issue';

/** Valid group keys: the same shape as a field name. */
export const GROUP_KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/;

/** Every declared group has an identifier key and a non-blank label. */
export const checkGroupKeys: TypeRule = (type) => {
    const issues: SchemaIssue[] = [];
    for (const [key, group] of Object.entries(type.groups ?? {})) {
        const path = groupPath(type.name, key);
        if (!GROUP_KEY_RE.test(key)) {
            issues.push(
                issue(
                    path,
                    'group.key',
                    `Group "${type.name}.${key}" must be an identifier ` +
                        `(letters, digits, underscores; starting with a letter).`
                )
            );
        }
        if (typeof group.label !== 'string' || !group.label.trim()) {
            issues.push(
                issue(
                    path,
                    'group.label',
                    `Group "${type.name}.${key}" needs a label.`
                )
            );
        }
    }
    return issues;
};
