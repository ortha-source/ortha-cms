import type { AlarmSeverity } from '../../../types/alarm';

/** One finding, as `admin_alarms_findings` returns it. */
export interface ToolFinding {
    title: string;
    rule: string;
    severity: AlarmSeverity;
    contentType: string;
    entryId: string;
    openForDays: number;
}

/** The whole tool result, once it has been recognised. */
export interface ToolFindings {
    items: ToolFinding[];
    total: number;
    bySeverity: Record<AlarmSeverity, number>;
    page: number;
    pageSize: number;
}

const SEVERITIES: readonly AlarmSeverity[] = ['error', 'warn', 'info'];

function isSeverity(value: unknown): value is AlarmSeverity {
    return SEVERITIES.includes(value as AlarmSeverity);
}

function str(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function num(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Reads a stored tool result into the shape this component renders, or `null`
 * when it is not one.
 *
 * **Parsing rather than casting, and that is the whole point of this file.**
 * A transcript is replayed from history: a result written by last month's
 * version of the tool arrives at today's renderer, and the two need not agree.
 * A cast would turn that into `undefined.map is not a function` inside a chat
 * message — a crashed transcript, which is a far worse failure than a JSON
 * blob. Returning `null` lets `ToolStep` fall through to the raw payload it
 * would have shown anyway.
 *
 * Unknown severities are dropped rather than coerced: a finding rendered as the
 * wrong severity is worse than one not rendered, and the count in the header
 * comes from `bySeverity` so the total stays honest either way.
 */
export function readToolFindings(output: unknown): ToolFindings | null {
    if (!output || typeof output !== 'object' || Array.isArray(output)) {
        return null;
    }
    const record = output as Record<string, unknown>;
    if (!Array.isArray(record['items'])) return null;

    const items = record['items']
        .filter(
            (item): item is Record<string, unknown> =>
                !!item && typeof item === 'object' && !Array.isArray(item)
        )
        .filter((item) => isSeverity(item['severity']))
        .map((item) => ({
            title: str(item['title']),
            rule: str(item['rule']),
            severity: item['severity'] as AlarmSeverity,
            contentType: str(item['contentType']),
            entryId: str(item['entryId']),
            openForDays: num(item['openForDays'])
        }));

    const counts = (record['bySeverity'] ?? {}) as Record<string, unknown>;
    return {
        items,
        // `total` is the count of everything matching, which may exceed the
        // page — falling back to the page length keeps the header truthful for
        // an older payload that had no total rather than reporting zero.
        total:
            typeof record['total'] === 'number'
                ? record['total']
                : items.length,
        bySeverity: {
            error: num(counts['error']),
            warn: num(counts['warn']),
            info: num(counts['info'])
        },
        page: num(record['page']) || 1,
        pageSize: num(record['pageSize']) || items.length
    };
}

/**
 * The width of one finding's age bar, as a percentage.
 *
 * Scaled against the **oldest finding in this result**, not against a fixed
 * span: the useful comparison in a list of six is between those six, and a
 * fixed axis would render a set that is all a week old as six invisible slivers
 * and a set that is all two years old as six full bars. Both readings are
 * useless; relative is the one that says something.
 *
 * A floor of 4% so a finding opened today is still a visible mark rather than
 * nothing — the row means "this exists and is new", not "this has no age".
 */
export function ageBarWidth(days: number, oldestDays: number): number {
    if (oldestDays <= 0) return 4;
    return Math.max(4, Math.round((Math.max(days, 0) / oldestDays) * 100));
}

/** The largest `openForDays` in a set, or 0 for an empty one. */
export function oldestOf(items: readonly ToolFinding[]): number {
    return items.reduce((max, item) => Math.max(max, item.openForDays), 0);
}
