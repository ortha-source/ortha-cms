/**
 * Look a **user-supplied** name up in a schema map, ignoring anything the map
 * merely inherits.
 *
 * Every whitelist in this package — `FilterSchema.fields`, `.relations`, a
 * `RelationSchema`'s nested maps, drizzle's own column map — is a plain object
 * literal, so a bare `map[name]` also resolves `constructor`, `toString`,
 * `valueOf`, `hasOwnProperty` and the rest of `Object.prototype` to truthy
 * values. A `!map[name]` guard therefore accepts a name nobody declared, and
 * the schema stops being the security boundary it is documented to be.
 *
 * Downstream neither outcome is a harmless no-match:
 *
 * - a scalar path (`?filter={"field":"constructor",…}`) reaches `columnOf`,
 *   which resolves the same inherited member off the column map and hands a
 *   `Function` to drizzle as a `Column`. The emitted fragment is `$1 = ` —
 *   a Postgres syntax error, i.e. a **user-triggerable 500** on every
 *   filterable endpoint.
 * - a relation-shaped path (`?filter={"field":"toString.constructor",…}`)
 *   falls out of `relationExists`'s `switch (rel.kind)` as `undefined`, so the
 *   predicate is **silently dropped** and the endpoint answers 200 unfiltered.
 *
 * Returning `undefined` here lets each call site raise its own
 * `FILTER_UNKNOWN_FIELD` / `FILTER_UNKNOWN_RELATION`, which is what a caller
 * asking for an undeclared name should always have got.
 */
export function own<T>(
    map: Record<string, T> | undefined,
    name: string
): T | undefined {
    if (!map) return undefined;
    return Object.hasOwn(map, name) ? map[name] : undefined;
}
