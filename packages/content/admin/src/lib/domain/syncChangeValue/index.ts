/** Longest value the sync preview prints inline before saying only "changed". */
export const SYNC_VALUE_MAX_LENGTH = 60;

/**
 * How the sync preview prints one side of a value change — `null` when it
 * cannot be printed usefully and the row should only say that the value
 * changed.
 *
 * A preview row is read at a glance, so it prints what reads as a value:
 * text, numbers, booleans, a short list of words. A rich-text document, a
 * JSON blob, a media id or a long paragraph is a value nobody compares by
 * eye, and printing it would turn the dialog into a diff tool. Empty values
 * read as an empty string, which the row renders as a dash.
 */
export function formatSyncValue(value: unknown): string | null {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    if (typeof value === 'string') {
        return value.length <= SYNC_VALUE_MAX_LENGTH ? value : null;
    }
    if (
        Array.isArray(value) &&
        value.every((item) => typeof item === 'string')
    ) {
        const joined = value.join(', ');
        return joined.length <= SYNC_VALUE_MAX_LENGTH ? joined : null;
    }
    return null;
}
