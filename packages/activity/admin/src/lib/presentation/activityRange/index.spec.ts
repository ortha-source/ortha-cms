import {
    ACTIVITY_RANGES,
    DEFAULT_RANGE,
    RANGE_MESSAGES,
    parseRange,
    rangeDays,
    rangeStart
} from './index';

describe('the Activity time range', () => {
    const now = new Date(2026, 9, 24, 15, 42, 7);

    it('opens on the last 7 days, the range the page’s subtitle names', () => {
        expect(DEFAULT_RANGE).toBe('7d');
        expect(parseRange(null)).toBe('7d');
    });

    it('reads every known range from the URL, and the default for anything else', () => {
        for (const range of ACTIVITY_RANGES) {
            expect(parseRange(range)).toBe(range);
        }
        expect(parseRange('week')).toBe(DEFAULT_RANGE);
        expect(parseRange('')).toBe(DEFAULT_RANGE);
    });

    it('anchors every bounded range on local midnight, today included', () => {
        expect(rangeStart('today', now)).toEqual(new Date(2026, 9, 24));
        expect(rangeStart('7d', now)).toEqual(new Date(2026, 9, 18));
        expect(rangeStart('30d', now)).toEqual(new Date(2026, 8, 25));
        expect(rangeStart('90d', now)).toEqual(new Date(2026, 6, 27));
    });

    it('gives the same instant for every render of a day — a stable query key', () => {
        const later = new Date(2026, 9, 24, 23, 59, 59);
        expect(rangeStart('7d', later)?.getTime()).toBe(
            rangeStart('7d', now)?.getTime()
        );
    });

    it('has no bound for all time', () => {
        expect(rangeStart('all', now)).toBeNull();
        expect(rangeDays('all')).toBeNull();
        expect(rangeDays('today')).toBe(1);
        expect(rangeDays('7d')).toBe(7);
    });

    it('labels every range', () => {
        expect(Object.keys(RANGE_MESSAGES).sort()).toEqual(
            [...ACTIVITY_RANGES].sort()
        );
    });
});
