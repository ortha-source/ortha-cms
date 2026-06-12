/**
 * `collection()` / `single()` — the two entry points of the content DSL.
 * Both normalize options, build the physical tables, and return a typed
 * {@link ContentType} the host registers via `ContentPlugin({ types })`
 * and re-exports (the tables) for drizzle-kit.
 */

import type { AnyFieldSpec } from '../types/fields';
import type {
    ContentType,
    ContentTypeOptions,
    SingleOptions
} from '../types/content-type';
import { buildTables, snakeCase } from './table-builder';

/** Valid machine names: snake_case, starting with a letter. */
const NAME_RE = /^[a-z][a-z0-9_]*$/;

function assertName(name: string): void {
    if (!NAME_RE.test(name)) {
        throw new Error(
            `Content type name "${name}" must be snake_case ` +
                `(letters, digits, underscores; starting with a letter).`
        );
    }
}

function assertFieldNames(
    typeName: string,
    fields: Record<string, AnyFieldSpec>
): void {
    const names = Object.keys(fields);
    if (names.length === 0) {
        throw new Error(`Content type "${typeName}" defines no fields.`);
    }
    const reserved = new Set([
        'id',
        'workspace_id',
        'status',
        'created_at',
        'updated_at'
    ]);
    for (const name of names) {
        if (reserved.has(snakeCase(name))) {
            throw new Error(
                `Field "${name}" on "${typeName}" collides with an envelope column.`
            );
        }
    }
}

/**
 * Defines a multi-entry collection.
 *
 * @example
 *   export const post = collection('post', {
 *       label: 'Blog posts',
 *       fields: {
 *           title: f.text({ required: true }),
 *           author: f.relation({ to: () => author })
 *       }
 *   });
 */
export function collection<TFields extends Record<string, AnyFieldSpec>>(
    name: string,
    options: ContentTypeOptions<TFields>
): ContentType<TFields> {
    assertName(name);
    assertFieldNames(name, options.fields);
    const { table, joinTables } = buildTables(name, options.fields);
    return {
        name,
        kind: 'collection',
        label: options.label ?? name,
        description: options.description,
        fields: options.fields,
        table,
        joinTables
    };
}

/**
 * Defines a single (a standalone page with a route path). Same storage
 * model as a collection — the admin just treats it as one entry.
 */
export function single<TFields extends Record<string, AnyFieldSpec>>(
    name: string,
    options: SingleOptions<TFields>
): ContentType<TFields> {
    assertName(name);
    assertFieldNames(name, options.fields);
    if (!options.path.startsWith('/')) {
        throw new Error(
            `Single "${name}" path must start with "/" (got "${options.path}").`
        );
    }
    const { table, joinTables } = buildTables(name, options.fields);
    return {
        name,
        kind: 'single',
        label: options.label ?? name,
        description: options.description,
        path: options.path,
        fields: options.fields,
        table,
        joinTables
    };
}
