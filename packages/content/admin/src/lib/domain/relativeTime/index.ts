/**
 * The largest unit that fits `elapsedSeconds`, as the `[value, unit]` pair
 * `Intl.RelativeTimeFormat` (and react-intl's `formatRelativeTime`) take —
 * negative, since every caller says how long *ago* something happened.
 */
export function relativeUnit(
    elapsedSeconds: number
): [number, Intl.RelativeTimeFormatUnit] {
    const minutes = Math.round(elapsedSeconds / 60);
    if (minutes < 60) return [-minutes, 'minute'];
    const hours = Math.round(minutes / 60);
    if (hours < 24) return [-hours, 'hour'];
    return [-Math.round(hours / 24), 'day'];
}

/** {@link relativeUnit} for an ISO timestamp, measured from `now`. */
export function relativeUnitSince(
    iso: string,
    now: number = Date.now()
): [number, Intl.RelativeTimeFormatUnit] {
    return relativeUnit(Math.max(0, (now - Date.parse(iso)) / 1000));
}
