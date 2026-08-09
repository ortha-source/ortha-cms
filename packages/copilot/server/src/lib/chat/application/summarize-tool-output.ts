/** Longest summary we store or show. */
const MAX_SUMMARY_LENGTH = 120;

/**
 * One line describing what a tool returned — `12 results`, `3 fields`, `ok`.
 *
 * This is what the collapsed tool step shows ("searched articles · 12
 * results", design §2) and what the audit row keeps instead of the whole
 * output. Storing the full result would copy entry bodies into an append-only
 * table with a different deletion story from the content itself; the transcript
 * already holds what the model actually saw.
 *
 * Deliberately shape-driven rather than tool-aware: a tool returning
 * `{ items: [...] }` gets a count for free, and a tool this function has never
 * heard of still gets something honest rather than nothing.
 */
export function summarizeToolOutput(output: unknown): string {
    return clip(describe(output));
}

function describe(output: unknown): string {
    if (output === null || output === undefined) {
        return 'no result';
    }
    if (Array.isArray(output)) {
        return count(output.length, 'result');
    }
    if (typeof output !== 'object') {
        return String(output);
    }

    const record = output as Record<string, unknown>;

    // The common list shape: `{ items, total }`. Prefer the reported total
    // over the page length — "12 results" is more useful than "10 results" when
    // the caller asked for the first page of twelve.
    const items = record['items'] ?? record['rows'] ?? record['results'];
    if (Array.isArray(items)) {
        const total = record['total'] ?? record['totalCount'];
        return typeof total === 'number'
            ? count(total, 'result')
            : count(items.length, 'result');
    }

    if (typeof record['total'] === 'number') {
        return count(record['total'], 'result');
    }

    const keys = Object.keys(record);
    if (keys.length === 0) {
        return 'no result';
    }
    // A single object — name it by what it is rather than counting it.
    return `1 result (${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', …' : ''})`;
}

/** `1 result` / `12 results`. */
function count(n: number, noun: string): string {
    return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

function clip(text: string): string {
    return text.length <= MAX_SUMMARY_LENGTH
        ? text
        : `${text.slice(0, MAX_SUMMARY_LENGTH - 1)}…`;
}
