import { BadRequestException } from '@nestjs/common';
import type { AnyContentType } from '../../../types/content-type';
import { CONTENT_FIELD_TYPE } from '../../../types/fields';

/**
 * The set of field names a `?fields=` list selects, or `undefined` when the
 * caller asked for none (the default — the whole record).
 */
export type FieldSelection = ReadonlySet<string> | undefined;

/**
 * Parse `?fields=title,slug` into the set {@link toRecord} projects `values`
 * down to. Only fields that carry a column are selectable — a many-relation or
 * an inverse back-reference has no value on the row (its links live in a join
 * table), so naming one is a client error, not a silently empty key.
 *
 * **Unknown names are rejected with a 400**, deliberately unlike
 * `?relationFields=`, which drops them. That list is an internal rendering hint
 * where a hidden column legitimately vanishes; this one is an external API
 * contract, where silently honouring `?fields=titel` would return records with
 * no fields and no explanation. Failing loudly makes the typo obvious.
 *
 * Envelope data (`id`, timestamps, `status`/`publishedAt`, `locale`) is **not**
 * selectable and is always returned — it identifies the record rather than
 * describing it, and callers can ignore what they don't need.
 */
export function parseFieldSelection(
    type: AnyContentType,
    raw: string | undefined
): FieldSelection {
    if (raw === undefined) return undefined;
    const wanted = raw
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean);
    // `?fields=` with nothing after it reads as "no selection", not "no fields":
    // returning an empty record for an empty param would be a trap.
    if (!wanted.length) return undefined;

    const unknown = wanted.filter((name) => !isSelectable(type, name));
    if (unknown.length) {
        throw new BadRequestException(
            `Unknown field(s) for "${type.name}": ${unknown.join(', ')}`
        );
    }
    return new Set(wanted);
}

/** A field is selectable when it is declared on the type and owns a column. */
function isSelectable(type: AnyContentType, name: string): boolean {
    const spec = type.fields[name];
    if (!spec) return false;
    return !(
        spec.type === CONTENT_FIELD_TYPE.Relation &&
        (spec.relation?.many || spec.relation?.inverse)
    );
}
