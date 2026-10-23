/**
 * The largest unit that fits `elapsedSeconds`, as the `[value, unit]` pair
 * `Intl.RelativeTimeFormat` (and react-intl's `formatRelativeTime`) take —
 * negative, since every caller says how long *ago* something happened.
 */
export function relativeUnit(
    elapsedSeconds: number
): [number, Intl.RelativeTimeFormatUnit] {
    const minutes = Math.round(elapsedSeconds / 60);
    if (minutes < 60) return [0 - minutes, 'minute'];
    const hours = Math.round(minutes / 60);
    if (hours < 24) return [0 - hours, 'hour'];
    return [0 - Math.round(hours / 24), 'day'];
}

/** Past this many days a timestamp reads better as a date than as "40 days ago". */
export const RELATIVE_DAYS = 7;

/**
 * How to say when `iso` happened: relative within {@link RELATIVE_DAYS} ("12
 * min ago", "yesterday"), else a date — carrying the year only when it is not
 * this one. A timestamp from the future (clock skew) reads as now.
 *
 * Pure, so each package formats the answer with its own `react-intl`.
 */
export function sinceParts(
    iso: string,
    now: number = Date.now()
):
    | { kind: 'relative'; value: number; unit: Intl.RelativeTimeFormatUnit }
    | { kind: 'date'; date: Date; withYear: boolean } {
    const elapsed = Math.max(0, (now - Date.parse(iso)) / 1000);
    const [value, unit] = relativeUnit(elapsed);
    if (unit !== 'day' || -value < RELATIVE_DAYS) {
        return { kind: 'relative', value, unit };
    }
    const date = new Date(iso);
    return {
        kind: 'date',
        date,
        withYear: date.getFullYear() !== new Date(now).getFullYear()
    };
}
