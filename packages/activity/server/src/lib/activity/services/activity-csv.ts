import type { ActivityEventView } from '../types/activity-view';

/**
 * The CSV columns of `GET /api/activity/export`, in order. Every field of the
 * wire view, because an export is the record handed to somebody outside the
 * product — an auditor, a spreadsheet — and a column left out is a fact they
 * cannot get back. `meta` travels as its JSON.
 */
export const ACTIVITY_CSV_COLUMNS = [
    'at',
    'kind',
    'actor_type',
    'actor_id',
    'actor_email',
    'subject_type',
    'subject_id',
    'subject_label',
    'workspace_id',
    'event_id',
    'meta'
] as const;

/**
 * Characters a spreadsheet reads as the start of a formula when they open a
 * cell. `meta`, the subject label and an actor's email are all, in the end,
 * typed by somebody, so a value like `=HYPERLINK(...)` would otherwise run in
 * the auditor's spreadsheet the moment they open the export (CSV injection,
 * OWASP). Such a cell is prefixed with `'`, the convention spreadsheets read as
 * "this is text".
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/**
 * One cell, quoted when it has to be (RFC 4180: a comma, a quote or a line
 * break) and defused when it would be read as a formula.
 */
export function csvCell(value: string | null | undefined): string {
    if (value === null || value === undefined) {
        return '';
    }
    const safe = FORMULA_LEAD.test(value) ? `'${value}` : value;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** The ISO instant, or `''` for a timestamp the row got wrong. */
function isoOrEmpty(at: Date): string {
    const time = at instanceof Date ? at.getTime() : Number.NaN;
    return Number.isNaN(time) ? '' : at.toISOString();
}

/** One event as a CSV line, in {@link ACTIVITY_CSV_COLUMNS} order. */
function csvLine(row: ActivityEventView): string {
    return [
        isoOrEmpty(row.at),
        row.kind,
        row.actorType,
        row.actorId,
        row.actorEmail,
        row.subjectType,
        row.subjectId,
        row.subjectLabel,
        row.workspaceId,
        row.id,
        row.meta ? JSON.stringify(row.meta) : null
    ]
        .map(csvCell)
        .join(',');
}

/**
 * The whole export: a header line, then one line per event, CRLF-terminated
 * (RFC 4180), with a UTF-8 byte-order mark so a spreadsheet that guesses the
 * encoding reads accented names and `→` correctly.
 *
 * Pure — no database, no Nest — so the escaping is unit-tested rather than
 * trusted.
 */
export function toActivityCsv(rows: readonly ActivityEventView[]): string {
    const lines = [ACTIVITY_CSV_COLUMNS.join(','), ...rows.map(csvLine)];
    return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/** The download's file name for a given instant: `activity-YYYY-MM-DD.csv`. */
export function activityCsvFileName(now: Date): string {
    return `activity-${now.toISOString().slice(0, 10)}.csv`;
}
