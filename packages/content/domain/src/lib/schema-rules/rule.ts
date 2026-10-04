import type { RuleField, RuleType } from './rule-type';
import type { SchemaIssue } from './schema-issue';

/** A rule over one type as a whole. */
export type TypeRule = (type: RuleType) => SchemaIssue[];

/**
 * A rule over one field. `columns` is shared across the field pass so the
 * column rule can see the fields before this one, in declaration order.
 */
export interface FieldPass {
    readonly columns: Map<string, string>;
}
export type FieldRule = (
    type: RuleType,
    name: string,
    field: RuleField,
    pass: FieldPass
) => SchemaIssue[];

/** A rule that needs every type at once. */
export type SetRule = (types: readonly RuleType[]) => SchemaIssue[];
