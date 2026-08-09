import { GraphQLScalarType, Kind, type ValueNode } from 'graphql';

/**
 * The custom scalars the generated schema needs. Each maps to a JSON value the
 * REST API already sends, because the two protocols serve the same
 * `PublicEntry` — a GraphQL-specific encoding would make the parity tests lie.
 */

/**
 * An arbitrary JSON value — what a `json` content field holds, and how a filter
 * tree is passed in.
 *
 * `serialize` is the identity function: the value came out of a `jsonb` column
 * (or out of `PublicEntry.values`) and is already a plain JSON value, so there
 * is nothing to coerce. Input goes back out unchanged for the same reason —
 * `EntryValidationService` is the authority on whether it is acceptable for the
 * field, and a second opinion here could only disagree with it.
 */
export const GraphQLJSON = new GraphQLScalarType({
    name: 'JSON',
    description:
        'An arbitrary JSON value — an object, array, string, number, boolean, or null. Used for `json` content fields and for the `filter` argument, whose tree is the same shape the REST `?filter=` parameter takes.',
    serialize: (value) => value,
    parseValue: (value) => value,
    parseLiteral: parseJsonLiteral
});

/**
 * An ISO 8601 timestamp, as a string.
 *
 * A string rather than a `Date`, because the REST API serialises timestamps
 * with `toISOString()` and this API must return **the same characters** — a
 * consumer switching protocols should not have to re-parse anything. The scalar
 * exists for the type name alone: it documents "this string is a timestamp" in
 * the SDL, which `String` cannot.
 */
export const GraphQLDateTime = new GraphQLScalarType<string, string>({
    name: 'DateTime',
    description:
        'An ISO 8601 timestamp string, e.g. `2026-08-08T12:34:56.000Z` — byte-identical to what the REST API returns for the same field.',
    serialize: (value) =>
        value instanceof Date ? value.toISOString() : String(value),
    parseValue: (value) => String(value)
});

/**
 * A date without a time, as an ISO `YYYY-MM-DD` string — what a `date` content
 * field stores and what REST returns for one.
 */
export const GraphQLDate = new GraphQLScalarType<string, string>({
    name: 'Date',
    description:
        'An ISO 8601 calendar date string, e.g. `2026-08-08`, with no time component.',
    serialize: (value) =>
        value instanceof Date
            ? value.toISOString().slice(0, 10)
            : String(value),
    parseValue: (value) => String(value)
});

/**
 * Recursively turns a GraphQL literal into the plain JS value it denotes, for
 * a `JSON` argument written inline in a query document rather than passed as a
 * variable. (Variables take the `parseValue` path, which needs none of this.)
 */
function parseJsonLiteral(node: ValueNode): unknown {
    switch (node.kind) {
        case Kind.STRING:
        case Kind.BOOLEAN:
            return node.value;
        case Kind.INT:
        case Kind.FLOAT:
            return Number(node.value);
        case Kind.OBJECT: {
            const out: Record<string, unknown> = {};
            for (const field of node.fields) {
                out[field.name.value] = parseJsonLiteral(field.value);
            }
            return out;
        }
        case Kind.LIST:
            return node.values.map(parseJsonLiteral);
        case Kind.NULL:
            return null;
        default:
            // An enum or a variable reference nested inside a literal object.
            // Neither can appear in a filter tree, and guessing at one would
            // produce a filter the caller did not write.
            return undefined;
    }
}
