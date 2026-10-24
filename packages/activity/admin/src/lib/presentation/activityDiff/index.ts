import type { ActivityEvent } from '../../types/activityEvent';

/** One line of an event's before/after table. */
export type ActivityDiffRow = {
    /** The `meta` key the change was recorded under (`role` for a bare pair). */
    key: string;
    /** The value before, as recorded — any JSON value, or `undefined`. */
    before: unknown;
    /** The value after, as recorded. */
    after: unknown;
};

/** A plain object, as opposed to an array, `null` or a scalar. */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A `{ from, to }` transition — the shape every producer records a change in. */
function isTransition(
    value: unknown
): value is { from?: unknown; to?: unknown } {
    return isRecord(value) && ('from' in value || 'to' in value);
}

/**
 * The before/after pairs an event recorded, in the order `meta` lists them.
 *
 * No producer writes a separate "diff" — they write **transitions**, and this
 * reads both shapes they use:
 * - a bare `{ from, to }` on the payload itself (`user.role_changed`), which
 *   is the change of the kind's one field and is keyed by what that field is;
 * - `{ <field>: { from, to } }` per field (`user.profile_updated`'s name,
 *   `alarm.rule.updated`'s `enabled`, `segment.updated`'s tags, a saved view's
 *   visibility, a copilot skill's mode).
 *
 * Nothing is inferred: a kind that recorded only *which* fields changed
 * (`entry.updated`'s `fields`) has no before/after to show, and gets none
 * rather than a table of blanks. Pure — the presentation formats the values.
 */
export function activityDiff(event: ActivityEvent): ActivityDiffRow[] {
    const meta = event.meta;
    if (!meta) return [];
    const rows: ActivityDiffRow[] = [];
    const bareFrom = meta['from'];
    const bareTo = meta['to'];
    if (
        (bareFrom !== undefined || bareTo !== undefined) &&
        !isRecord(bareFrom) &&
        !isRecord(bareTo)
    ) {
        rows.push({
            key: event.kind === 'user.role_changed' ? 'role' : 'value',
            before: bareFrom,
            after: bareTo
        });
    }
    for (const [key, value] of Object.entries(meta)) {
        if (key === 'via' || !isTransition(value)) continue;
        rows.push({ key, before: value.from, after: value.to });
    }
    return rows;
}

/**
 * A `meta` key as a column label when the presentation has no message for it:
 * `sessionsRevoked` → "Sessions revoked", `content_type` → "Content type".
 */
export function humanizeKey(key: string): string {
    const words = key
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_.-]+/g, ' ')
        .trim()
        .toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
}
