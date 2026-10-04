import type { SetRule } from '../rule';
import { issue, typePath, type SchemaIssue } from '../schema-issue';

export const checkDuplicateNames: SetRule = (types) => {
    const seen = new Set<string>();
    const issues: SchemaIssue[] = [];
    for (const type of types) {
        if (seen.has(type.name)) {
            issues.push(
                issue(
                    typePath(type.name),
                    'type.duplicate',
                    `Duplicate content type "${type.name}" — names must be unique.`
                )
            );
        }
        seen.add(type.name);
    }
    return issues;
};
