import type { ActivityEventView } from '../types/activity-view';
import {
    ACTIVITY_CSV_COLUMNS,
    activityCsvFileName,
    csvCell,
    toActivityCsv
} from './activity-csv';

/** One wire row, with every field set so a column cannot go missing quietly. */
function view(overrides: Partial<ActivityEventView> = {}): ActivityEventView {
    return {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        kind: 'entry.published',
        subjectType: 'content_entry',
        subjectId: 'e-1',
        subjectLabel: 'Spring launch',
        actorId: '11111111-1111-4111-8111-111111111111',
        actorType: 'user',
        actorEmail: 'grace@example.com',
        workspaceId: '22222222-2222-4222-8222-222222222222',
        meta: { contentType: 'article', title: 'Spring launch' },
        at: new Date('2026-10-24T10:42:00.000Z'),
        ...overrides
    };
}

describe('the activity CSV export [activity:I-41]', () => {
    describe('csvCell', () => {
        it('leaves a plain value alone and an absent one empty', () => {
            expect(csvCell('grace@example.com')).toBe('grace@example.com');
            expect(csvCell(null)).toBe('');
            expect(csvCell(undefined)).toBe('');
        });

        it('quotes commas, quotes and line breaks (RFC 4180)', () => {
            expect(csvCell('a, b')).toBe('"a, b"');
            expect(csvCell('say "hi"')).toBe('"say ""hi"""');
            expect(csvCell('two\nlines')).toBe('"two\nlines"');
        });

        it.each(['=HYPERLINK("http://x")', '+1+1', '-2+3', '@SUM(A1)', '\t=1'])(
            'defuses %s so a spreadsheet reads it as text',
            (value) => {
                const cell = csvCell(value);
                // Quoted or not, the first character a spreadsheet sees in the
                // value is the apostrophe.
                expect(cell.replace(/^"/, '').startsWith("'")).toBe(true);
            }
        );
    });

    describe('toActivityCsv', () => {
        it('writes a BOM, the header and one CRLF line per row', () => {
            const csv = toActivityCsv([view(), view({ id: 'other' })]);
            expect(csv.startsWith('\uFEFF')).toBe(true);
            const lines = csv.slice(1).split('\r\n');
            expect(lines[0]).toBe(ACTIVITY_CSV_COLUMNS.join(','));
            // Header, two rows, and the empty string after the final CRLF.
            expect(lines).toHaveLength(4);
            expect(lines[3]).toBe('');
        });

        it('puts every field in its column, meta as JSON', () => {
            const [, line] = toActivityCsv([view()]).slice(1).split('\r\n');
            expect(line).toBe(
                [
                    '2026-10-24T10:42:00.000Z',
                    'entry.published',
                    'user',
                    '11111111-1111-4111-8111-111111111111',
                    'grace@example.com',
                    'content_entry',
                    'e-1',
                    'Spring launch',
                    '22222222-2222-4222-8222-222222222222',
                    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
                    '"{""contentType"":""article"",""title"":""Spring launch""}"'
                ].join(',')
            );
        });

        it('writes a system event with empty actor cells, not "null"', () => {
            const [, line] = toActivityCsv([
                view({
                    actorId: null,
                    actorType: null,
                    actorEmail: null,
                    meta: null,
                    subjectLabel: null,
                    workspaceId: null
                })
            ])
                .slice(1)
                .split('\r\n');
            expect(line).not.toContain('null');
            expect(line.split(',')).toHaveLength(ACTIVITY_CSV_COLUMNS.length);
        });

        it('survives a timestamp the row got wrong instead of throwing', () => {
            const csv = toActivityCsv([view({ at: new Date('not-a-date') })]);
            expect(csv.split('\r\n')[1].startsWith(',entry.published')).toBe(
                true
            );
        });

        it('defuses a user-authored label that starts a formula', () => {
            const [, line] = toActivityCsv([
                view({ subjectLabel: '=cmd|calc' })
            ])
                .slice(1)
                .split('\r\n');
            expect(line).toContain(",'=cmd|calc,");
        });

        it('is just the header for an empty view', () => {
            expect(toActivityCsv([])).toBe(
                `\uFEFF${ACTIVITY_CSV_COLUMNS.join(',')}\r\n`
            );
        });
    });

    it('names the file after the day it was taken', () => {
        expect(activityCsvFileName(new Date('2026-10-24T23:00:00.000Z'))).toBe(
            'activity-2026-10-24.csv'
        );
    });
});
