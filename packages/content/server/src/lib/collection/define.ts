/**
 * `collection()` / `single()` — the two entry points of the content DSL.
 * Both normalize options, build the physical tables, and return a typed
 * {@link ContentType} the host registers via `ContentPlugin({ types })`
 * and re-exports (the tables) for drizzle-kit.
 */

import type { PgTable } from 'drizzle-orm/pg-core';
import type { AnyFieldSpec } from '../types/fields';
import {
    CONTENT_TYPE_KIND,
    type AnyContentType,
    type ContentType,
    type ContentTypeOptions,
    type SingleOptions
} from '../types/content-type';
import { assertType } from './assert-type';
import { toFieldGroups } from './field-groups';
import { buildTables } from './table-builder';

/**
 * The generated join table for a many-relation field, or throw. Use this in
 * the host's drizzle-kit schema entry (`re-export`) so a renamed or removed
 * many-relation fails loudly at load instead of silently resolving to
 * `undefined` and dropping the join table from the generated migration.
 */
export function joinTableOf(type: AnyContentType, field: string): PgTable {
    const table = type.joinTables[field];
    if (!table) {
        throw new Error(
            `Content type "${type.name}" has no join table for ` +
                `many-relation "${field}".`
        );
    }
    return table;
}

/**
 * Defines a multi-entry collection.
 *
 * @example
 *   export const post = collection('post', {
 *       label: 'Blog posts',
 *       fields: {
 *           title: field.text({ required: true }),
 *           author: field.relation({ to: () => author })
 *       }
 *   });
 */
export function collection<TFields extends Record<string, AnyFieldSpec>>(
    name: string,
    options: ContentTypeOptions<TFields>
): ContentType<TFields> {
    const publishable = options.publishable ?? false;
    const paranoid = options.paranoid ?? false;
    const i18n = options.i18n ?? false;
    assertType(
        {
            name,
            kind: CONTENT_TYPE_KIND.Collection,
            i18n,
            groups: options.groups
        },
        options.fields
    );
    const groups = toFieldGroups(options.groups);
    const { table, joinTables } = buildTables(name, options.fields, {
        publishable,
        paranoid,
        i18n
    });
    return {
        name,
        kind: CONTENT_TYPE_KIND.Collection,
        label: options.label ?? name,
        description: options.description,
        publishable,
        paranoid,
        i18n,
        groups,
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
    const publishable = options.publishable ?? false;
    const paranoid = options.paranoid ?? false;
    const i18n = options.i18n ?? false;
    assertType(
        {
            name,
            kind: CONTENT_TYPE_KIND.Single,
            path: options.path,
            i18n,
            groups: options.groups
        },
        options.fields
    );
    const groups = toFieldGroups(options.groups);
    const { table, joinTables } = buildTables(name, options.fields, {
        publishable,
        paranoid,
        i18n
    });
    return {
        name,
        kind: CONTENT_TYPE_KIND.Single,
        label: options.label ?? name,
        description: options.description,
        path: options.path,
        publishable,
        paranoid,
        i18n,
        groups,
        fields: options.fields,
        table,
        joinTables
    };
}
