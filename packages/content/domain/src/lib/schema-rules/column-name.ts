import type { RuleField } from './rule-type';

/**
 * A field or type name → its snake_case column name: camelCase boundaries and
 * any run of non-alphanumerics become one underscore. The table builder names
 * every column with this, so a rule and a table can never disagree.
 */
export function snakeCase(value: string): string {
    return value
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .toLowerCase();
}

/**
 * The main-table column a field lands in, or `null` when it has none: a
 * many-relation lives in a join table and an inverse in the owner's storage.
 * A single relation becomes `<field>_id`.
 */
export function mainColumnName(name: string, field: RuleField): string | null {
    if (field.type !== 'relation') return snakeCase(name);
    if (field.relation?.inverse || field.relation?.many) return null;
    return `${snakeCase(name)}_id`;
}
