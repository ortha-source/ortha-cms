import type { AlarmFindingView } from '../types/alarm-views';
import {
    buildFindingsToolOutput,
    daysSince,
    severityTally,
    toFindingToolItem
} from './findings-tool-output';

const NOW = new Date('2026-08-24T12:00:00.000Z');

const finding = (
    overrides: Partial<AlarmFindingView> = {}
): AlarmFindingView => ({
    ruleId: 'rule-1',
    ruleName: 'Relations point at published records',
    title: 'Author is not published',
    contentType: 'article',
    entryId: 'entry-1',
    severity: 'warn',
    state: 'open',
    detail: { field: 'author' },
    firstSeenAt: '2026-08-20T12:00:00.000Z',
    lastSeenAt: '2026-08-24T09:00:00.000Z',
    mutedReason: null,
    ...overrides
});

describe('daysSince', () => {
    it('counts whole days', () => {
        expect(daysSince('2026-08-20T12:00:00.000Z', NOW)).toBe(4);
    });

    it('floors a partial day to zero rather than rounding it up', () => {
        // Four hours old is "today". Rounding would call it a day and age
        // every finding by up to twelve hours — small, and exactly the kind of
        // thing a model then states as a fact.
        expect(daysSince('2026-08-24T08:00:00.000Z', NOW)).toBe(0);
        expect(daysSince('2026-08-23T23:00:00.000Z', NOW)).toBe(0);
    });

    it('never goes negative for a clock skewed into the future', () => {
        expect(daysSince('2026-09-01T00:00:00.000Z', NOW)).toBe(0);
    });

    it('reads an unparseable timestamp as zero rather than NaN', () => {
        // A NaN would reach the model as `null` and the renderer as a bar of
        // width NaN%. Zero is wrong by at most the finding's real age and
        // breaks nothing.
        expect(daysSince('not a date', NOW)).toBe(0);
    });
});

describe('toFindingToolItem', () => {
    it('projects the fields a model can act on', () => {
        expect(toFindingToolItem(finding(), NOW)).toEqual({
            title: 'Author is not published',
            rule: 'Relations point at published records',
            severity: 'warn',
            contentType: 'article',
            entryId: 'entry-1',
            muted: false,
            openForDays: 4
        });
    });

    it('drops the opaque detail bag and the raw timestamps', () => {
        const item = toFindingToolItem(finding(), NOW) as Record<
            string,
            unknown
        >;
        // `detail` is a jsonb payload whose shape belongs to the rule that
        // wrote it — tokens spent on something the model cannot interpret.
        expect(item).not.toHaveProperty('detail');
        expect(item).not.toHaveProperty('firstSeenAt');
        expect(item).not.toHaveProperty('lastSeenAt');
    });

    it('omits mutedReason entirely when there is none', () => {
        // Not `mutedReason: null` on every unmuted row: a key the model has to
        // read and discard, on every finding, forever.
        expect(toFindingToolItem(finding(), NOW)).not.toHaveProperty(
            'mutedReason'
        );
    });

    it('carries the mute and its reason when one was given', () => {
        const item = toFindingToolItem(
            finding({ state: 'muted', mutedReason: 'a stub on purpose' }),
            NOW
        );
        expect(item.muted).toBe(true);
        expect(item.mutedReason).toBe('a stub on purpose');
    });

    it('reports a mute with no reason as muted, without inventing one', () => {
        const item = toFindingToolItem(
            finding({ state: 'muted', mutedReason: null }),
            NOW
        );
        expect(item.muted).toBe(true);
        expect(item).not.toHaveProperty('mutedReason');
    });
});

describe('buildFindingsToolOutput', () => {
    it('names the list `items` so the run engine can summarise it', () => {
        // `summarizeToolOutput` is shape-driven: `{ items, total }` yields
        // "14 results" in the transcript with no tool-specific code. Renaming
        // the key would silently downgrade every step line to "1 result (…)".
        const output = buildFindingsToolOutput({
            findings: [finding(), finding({ entryId: 'entry-2' })],
            total: 14,
            bySeverity: { error: 2, warn: 5, info: 7 },
            page: 1,
            pageSize: 10,
            now: NOW
        });

        expect(Array.isArray(output.items)).toBe(true);
        expect(output.items).toHaveLength(2);
        expect(output.total).toBe(14);
    });

    it('carries the tally for the whole set, not for the page', () => {
        // The page is two of fourteen. A tally derived from the page would let
        // both the model and the rendered strip describe a sample as the whole.
        const output = buildFindingsToolOutput({
            findings: [finding(), finding({ entryId: 'entry-2' })],
            total: 14,
            bySeverity: { error: 2, warn: 5, info: 7 },
            page: 1,
            pageSize: 10,
            now: NOW
        });

        expect(output.bySeverity).toEqual({ error: 2, warn: 5, info: 7 });
        expect(
            output.bySeverity.error +
                output.bySeverity.warn +
                output.bySeverity.info
        ).toBe(14);
    });

    it('restates the paging, so a short list under a big total reads right', () => {
        const output = buildFindingsToolOutput({
            findings: [finding()],
            total: 14,
            bySeverity: { error: 0, warn: 14, info: 0 },
            page: 2,
            pageSize: 10,
            now: NOW
        });
        expect(output.page).toBe(2);
        expect(output.pageSize).toBe(10);
    });

    it('is empty-safe', () => {
        const output = buildFindingsToolOutput({
            findings: [],
            total: 0,
            bySeverity: { error: 0, warn: 0, info: 0 },
            page: 1,
            pageSize: 10,
            now: NOW
        });
        expect(output.items).toEqual([]);
        expect(output.total).toBe(0);
    });
});

describe('severityTally', () => {
    it('lists the present severities, most severe first', () => {
        expect(severityTally({ error: 2, warn: 5, info: 7 })).toBe(
            '2 errors, 5 warnings, 7 notes'
        );
    });

    it('drops the empty ones', () => {
        // "0 errors" is a fact nobody asked for, and listing all three every
        // time buries the one that matters.
        expect(severityTally({ error: 0, warn: 3, info: 0 })).toBe(
            '3 warnings'
        );
    });

    it('singularises', () => {
        expect(severityTally({ error: 1, warn: 1, info: 1 })).toBe(
            '1 error, 1 warning, 1 note'
        );
    });

    it('says so when there is nothing', () => {
        expect(severityTally({ error: 0, warn: 0, info: 0 })).toBe(
            'nothing flagged'
        );
    });
});
