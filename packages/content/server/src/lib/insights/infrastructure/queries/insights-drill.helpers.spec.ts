import {
    busiestWeekday,
    DEFAULT_DRILL_LIMIT,
    MAX_DRILL_LIMIT,
    normaliseTimeZone,
    oldestFirst,
    sortTypeCounts,
    staleAgeWindow,
    toDrillLimit,
    toStaleAge
} from './insights-drill.helpers';

describe('insights drill helpers', () => {
    describe('staleAgeWindow', () => {
        it('uses the stale chart’s own edges, so a band and its bar agree', () => {
            expect(staleAgeWindow('recent')).toEqual({
                fromDays: 30,
                toDays: 90
            });
            expect(staleAgeWindow('months')).toEqual({
                fromDays: 90,
                toDays: 365
            });
            // "Over a year" is open-ended.
            expect(staleAgeWindow('year')).toEqual({
                fromDays: 365,
                toDays: null
            });
        });
    });

    describe('toStaleAge', () => {
        it('accepts the three bands and falls back to a year otherwise', () => {
            expect(toStaleAge('recent')).toBe('recent');
            expect(toStaleAge('months')).toBe('months');
            expect(toStaleAge('year')).toBe('year');
            expect(toStaleAge(undefined)).toBe('year');
            expect(toStaleAge('constructor')).toBe('year');
        });
    });

    describe('toDrillLimit', () => {
        it('clamps to the panel’s cap and defaults on junk', () => {
            expect(toDrillLimit('5')).toBe(5);
            expect(toDrillLimit('9999')).toBe(MAX_DRILL_LIMIT);
            expect(toDrillLimit('0')).toBe(DEFAULT_DRILL_LIMIT);
            expect(toDrillLimit('-3')).toBe(DEFAULT_DRILL_LIMIT);
            expect(toDrillLimit('2.5')).toBe(DEFAULT_DRILL_LIMIT);
            expect(toDrillLimit(undefined)).toBe(DEFAULT_DRILL_LIMIT);
        });
    });

    describe('oldestFirst', () => {
        it('merges every type’s rows into one oldest-first list', () => {
            const at = (iso: string, id: string) => ({
                id,
                updatedAt: new Date(iso)
            });
            const merged = oldestFirst(
                [
                    at('2024-05-01', 'b'),
                    at('2023-01-01', 'a'),
                    at('2024-05-01', 'a2'),
                    at('2025-01-01', 'c')
                ],
                3
            );
            expect(merged.map((row) => row.id)).toEqual(['a', 'a2', 'b']);
        });
    });

    describe('sortTypeCounts', () => {
        it('drops empty types and puts the biggest first', () => {
            expect(
                sortTypeCounts([
                    { name: 'a', label: 'Articles', count: 3 },
                    { name: 'g', label: 'Guides', count: 9 },
                    { name: 'x', label: 'Empty', count: 0 },
                    { name: 'b', label: 'Blog', count: 3 }
                ]).map((entry) => entry.name)
            ).toEqual(['g', 'a', 'b']);
        });
    });

    describe('busiestWeekday', () => {
        it('names the day with the most publishes, earliest on a tie', () => {
            expect(
                busiestWeekday(
                    new Map([
                        [4, 9],
                        [2, 9],
                        [1, 3]
                    ])
                )
            ).toBe(2);
        });

        it('is null when nothing was published', () => {
            expect(busiestWeekday(new Map())).toBeNull();
            expect(busiestWeekday(new Map([[3, 0]]))).toBeNull();
        });
    });

    describe('normaliseTimeZone', () => {
        it('keeps a zone the runtime knows', () => {
            expect(normaliseTimeZone('Europe/Berlin')).toBe('Europe/Berlin');
        });

        it('falls back to UTC for anything else, rather than failing the read', () => {
            expect(normaliseTimeZone(undefined)).toBe('UTC');
            expect(normaliseTimeZone('Mars/Olympus_Mons')).toBe('UTC');
            expect(normaliseTimeZone("UTC'; drop table x;--")).toBe('UTC');
            expect(normaliseTimeZone('A'.repeat(80))).toBe('UTC');
        });
    });
});
