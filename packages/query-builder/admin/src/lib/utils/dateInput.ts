/**
 * Helpers bridging a stored wire value (a full ISO instant) and the
 * `YYYY-MM-DDTHH:mm` string an `<input type="datetime-local">` reads/writes.
 *
 * Date fields filter `timestamptz` columns, so the value on the wire must be a
 * precise instant — a date-only `YYYY-MM-DD` would coerce to midnight UTC on the
 * server and make `equals` / the upper bound of `between` match (almost) nothing
 * on the target day. Using `datetime-local` + ISO keeps every date operator
 * exact and round-trips through the URL.
 */

/**
 * Convert a stored ISO instant to the `YYYY-MM-DDTHH:mm` value a
 * `datetime-local` input expects, in the viewer's local timezone. Returns `''`
 * for empty or unparseable input so the input stays controlled.
 */
export function isoToLocalInput(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    // Shift by the local offset so toISOString() prints local wall-clock time,
    // then trim to minute precision.
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
}

/**
 * Inverse of {@link isoToLocalInput}: a `YYYY-MM-DDTHH:mm` local input value →
 * a stored ISO instant. Returns `''` for empty input.
 */
export function localInputToIso(local: string): string {
    if (!local) return '';
    const d = new Date(local);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString();
}
