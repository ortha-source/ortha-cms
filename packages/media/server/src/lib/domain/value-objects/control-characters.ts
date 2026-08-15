/**
 * True when a string contains a C0 control character or DEL.
 *
 * Names go three places at once: a Postgres `text` column, a
 * `Content-Disposition` header, and a provider's storage key. A `NUL` is not
 * representable in the first of those at all — Postgres answers
 * `invalid byte sequence for encoding "UTF8": 0x00` — so a rename carrying one
 * came back as a driver-level **500** for what is plainly a bad request. The
 * rest of the range is rejected on the same principle rather than left to each
 * consumer to escape.
 *
 * A codepoint scan rather than a regex literal: the equivalent character class
 * is exactly what `no-control-regex` exists to flag, and this says the intent
 * out loud.
 */
export function hasControlCharacters(value: string): boolean {
    for (const character of value) {
        const code = character.codePointAt(0) ?? 0;
        if (code < 0x20 || code === 0x7f) {
            return true;
        }
    }
    return false;
}
