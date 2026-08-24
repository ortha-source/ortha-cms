import {
    DEFAULT_RANGE,
    INSIGHTS_RANGES,
    RANGE_DAYS,
    insightsRangeParam,
    parseInsightsRange
} from './index';

/**
 * The query-string round-trip behind `?range=`. These are the rules a shared
 * dashboard link depends on, and the ones a browser test cannot state cheaply:
 * what a hand-edited value does, and which selection is allowed to be absent.
 */
describe('parseInsightsRange', () => {
    it('reads every offered range back', () => {
        for (const range of INSIGHTS_RANGES) {
            expect(parseInsightsRange(range)).toBe(range);
        }
    });

    it('falls back to the default when the param is absent', () => {
        expect(parseInsightsRange(null)).toBe(DEFAULT_RANGE);
        expect(parseInsightsRange(undefined)).toBe(DEFAULT_RANGE);
        expect(parseInsightsRange('')).toBe(DEFAULT_RANGE);
    });

    it('falls back to the default on a value it does not offer', () => {
        // A typo, a stale link, and a plausible-but-wrong spelling of 12m:
        // none of them should leave the page with no window at all.
        expect(parseInsightsRange('90')).toBe(DEFAULT_RANGE);
        expect(parseInsightsRange('90D')).toBe(DEFAULT_RANGE);
        expect(parseInsightsRange('1y')).toBe(DEFAULT_RANGE);
        expect(parseInsightsRange('__proto__')).toBe(DEFAULT_RANGE);
    });
});

describe('insightsRangeParam', () => {
    it('keeps the default out of the URL', () => {
        // So a bare `/insights` link keeps meaning "the current default"
        // rather than pinning itself to whatever it was when it was saved.
        expect(insightsRangeParam(DEFAULT_RANGE)).toBeUndefined();
    });

    it('names every other selection', () => {
        for (const range of INSIGHTS_RANGES) {
            if (range === DEFAULT_RANGE) continue;
            expect(insightsRangeParam(range)).toBe(range);
        }
    });

    it('round-trips through the query string', () => {
        for (const range of INSIGHTS_RANGES) {
            expect(parseInsightsRange(insightsRangeParam(range) ?? null)).toBe(
                range
            );
        }
    });
});

describe('RANGE_DAYS', () => {
    it('covers every offered range with a positive day count', () => {
        for (const range of INSIGHTS_RANGES) {
            expect(RANGE_DAYS[range]).toBeGreaterThan(0);
        }
    });
});
