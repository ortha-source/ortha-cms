import { BadRequestException } from '@nestjs/common';
import type { AnyContentType } from '../../types/content-type';
import { isPureValueField } from './public-entry-row';

/**
 * Upper bound on how many names a `?fields=` list may carry. Generous — no real
 * content type has this many — but it bounds the parse and the projection a
 * single request can provoke.
 */
const MAX_SELECTED_FIELDS = 100;

/**
 * Parse a `?fields=` selection into the set of value fields to return, or
 * `undefined` for "everything" (the parameter absent, or present but empty).
 *
 * Selection covers the **`values` bag only** — the envelope (`id`, timestamps,
 * `publishedAt`, `locale`, `localeGroupId`) is always returned. `id` in
 * particular is what a consumer needs to fetch the entry again, so letting a
 * selection drop it would be a foot-gun for no payload saving; the envelope is
 * a handful of small columns either way, while the weight a caller actually
 * wants to avoid is in the fields (a richtext body).
 *
 * An unrecognised name is a **400**, not a silent drop. A sparse fieldset is an
 * explicit request, so a typo should say so rather than quietly returning an
 * entry missing the field the caller asked for. Reference fields (relation and
 * media) get their own message, because "not selectable *yet*" is a different
 * fact from "no such field" and points at the API's current limit rather than
 * at the caller's spelling.
 */
export function parseFieldSelection(
    type: AnyContentType,
    raw: string | undefined
): ReadonlySet<string> | undefined {
    if (raw === undefined) {
        return undefined;
    }
    const names = [
        ...new Set(
            raw
                .split(',')
                .map((name) => name.trim())
                .filter(Boolean)
        )
    ];
    if (names.length === 0) {
        // `?fields=` with nothing in it reads as "no preference", not "no
        // fields" — an empty `values` bag is never what a caller meant.
        return undefined;
    }
    if (names.length > MAX_SELECTED_FIELDS) {
        throw new BadRequestException(
            `fields: at most ${MAX_SELECTED_FIELDS} names may be selected.`
        );
    }

    for (const name of names) {
        // `Object.hasOwn`, not `type.fields[name]`: the field map is the host's
        // plain object literal, passed through untouched, so a bare lookup also
        // resolves everything it INHERITS. `?fields=constructor` read back
        // `Object` — a function, so `!spec` was false and the "unknown field"
        // 400 never fired — and `isPureValueField` then asked for
        // `Object.type`, `undefined`, which is not a reference type, so the
        // second 400 never fired either. `constructor` landed in the selected
        // set and reached the projection builder, which put a class function
        // into the `.select()` list instead of a column: a 500 out of drizzle
        // on a public, token-authenticated endpoint. `toString`, `valueOf`,
        // `hasOwnProperty`, `isPrototypeOf`, `propertyIsEnumerable` and
        // `toLocaleString` all worked the same way.
        const spec = Object.hasOwn(type.fields, name)
            ? type.fields[name]
            : undefined;
        if (!spec) {
            throw new BadRequestException(
                `fields: unknown field "${name}" on "${type.name}".`
            );
        }
        if (!isPureValueField(spec)) {
            throw new BadRequestException(
                `fields: "${name}" is a ${spec.type} field and cannot be selected — this API does not return relation or media values yet.`
            );
        }
    }
    return new Set(names);
}
