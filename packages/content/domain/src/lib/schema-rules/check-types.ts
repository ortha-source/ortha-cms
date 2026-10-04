import { checkFieldOptions } from './check-field-options';
import { checkType } from './check-type';
import { checkTypeSet } from './check-type-set';
import type { RuleType } from './rule-type';
import type { SchemaIssue } from './schema-issue';

/**
 * Everything a whole schema must satisfy — each type, each field's options, and
 * the set — for a schema that exists only as data. What the builder shows.
 */
export function checkTypes(types: readonly RuleType[]): SchemaIssue[] {
    return [
        ...types.flatMap((type) => [
            ...checkType(type),
            ...checkFieldOptions(type)
        ]),
        ...checkTypeSet(types)
    ];
}
