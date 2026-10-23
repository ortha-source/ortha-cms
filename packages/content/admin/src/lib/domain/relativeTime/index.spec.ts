import { describe, expect, it } from 'vitest';
import { relativeUnit, relativeUnitSince } from './index';

describe('relativeUnit', () => {
    it('takes the largest unit that fits, said as "ago"', () => {
        expect(relativeUnit(30)).toEqual([-1, 'minute']);
        expect(relativeUnit(59 * 60)).toEqual([-59, 'minute']);
        expect(relativeUnit(3 * 3600)).toEqual([-3, 'hour']);
        expect(relativeUnit(3 * 86400)).toEqual([-3, 'day']);
    });

    it('reads a timestamp from the future as now, not as "in 5 minutes"', () => {
        const now = Date.parse('2026-10-23T12:00:00Z');
        expect(relativeUnitSince('2026-10-23T12:05:00Z', now)).toEqual([
            -0,
            'minute'
        ]);
    });
});
