import type { WireFilterField } from '../entries/types/filter-surface';

/**
 * The operators the filter engine accepts, as the model sees them. Mirrors
 * `FilterOperator` in `@ortha-cms/utils-server` — restated rather than imported
 * so the descriptions can be written *for a model* instead of for a developer.
 */
export const FILTER_OPERATORS = [
    'eq',
    'ne',
    'gt',
    'gte',
    'lt',
    'lte',
    'in',
    'nin',
    'like',
    'ilike',
    'nilike',
    'null'
] as const;

/**
 * The JSON Schema for a filter tree, handed to the model as
 * `admin_content_search`'s `filter` parameter.
 *
 * The grammar is the query builder's own — a node is either a group
 * (`{and: […]}` / `{or: […]}`) or a rule (`{field, op, value}`) — so the model
 * emits exactly what the admin's UI emits and the same parser validates both.
 * **The model never writes SQL**: `parseFilterTree` checks every path against a
 * schema derived from the content type, so an unknown field or an ungranted
 * relation hop is a rejected filter, not a query.
 *
 * `$ref`/`$defs` are deliberately avoided — a recursive schema is exactly the
 * thing small models handle worst, and our own `validateToolInput` ignores
 * `$ref` anyway. Two literal levels of nesting cover every filter the admin's
 * own query builder can produce, and a deeper one still *works*: the validator
 * only checks what it is given, and the real depth limit is the parser's.
 */
export function filterTreeSchema(): Record<string, unknown> {
    const rule = {
        type: 'object',
        properties: {
            field: {
                type: 'string',
                description:
                    'A filterable path from admin_content_types → filterableFields, e.g. "status" or "author.name".'
            },
            op: { type: 'string', enum: [...FILTER_OPERATORS] },
            value: {
                description:
                    'The comparison value. An array for in/nin; a boolean for null (true = IS NULL); omitted values are rejected.'
            }
        },
        required: ['field', 'op'],
        additionalProperties: false
    } as const;

    const group = (of: unknown) => ({
        type: 'object',
        properties: {
            and: { type: 'array', items: of },
            or: { type: 'array', items: of }
        },
        additionalProperties: false
    });

    return {
        ...group({ anyOf: [rule, group(rule)] }),
        description:
            'A filter tree. Either a group — {"and":[…]} or {"or":[…]} — or, nested inside one, ' +
            'rules of the form {"field":"status","op":"eq","value":"published"}. ' +
            'Only paths listed by admin_content_types are accepted.'
    };
}

/**
 * The filterable paths, flattened for a model.
 *
 * `WireFilterField` carries a `group` breadcrumb for the admin's picker UI,
 * which is noise here — a model wants the dotted path, the coercion type, and
 * the allowed values for an enum. Trimming it also keeps `admin_content_types`
 * affordable on a type with a wide relation graph.
 */
export function describeFilterFields(
    fields: readonly WireFilterField[]
): Array<{
    path: string;
    type: string;
    values?: readonly string[];
    relationTo?: string;
}> {
    return fields.map((field) => ({
        path: field.path,
        type: field.type,
        ...(field.enumValues ? { values: field.enumValues } : {}),
        ...(field.relationTarget ? { relationTo: field.relationTarget } : {})
    }));
}
