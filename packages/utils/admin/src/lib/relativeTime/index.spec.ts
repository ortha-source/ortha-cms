import { describe, expect, it } from 'vitest';
import { relativeUnit, sinceParts } from './index';

const NOW = Date.parse('2026-10-23T12:00:00Z');

describe('relativeUnit', () => {
    it('takes the largest unit that fits, said as "ago"', () => {
        expect(relativeUnit(30)).toEqual([-1, 'minute']);
        expect(relativeUnit(59 * 60)).toEqual([-59, 'minute']);
        expect(relativeUnit(3 * 3600)).toEqual([-3, 'hour']);
        expect(relativeUnit(3 * 86400)).toEqual([-3, 'day']);
    });
});

describe('sinceParts', () => {
    it('is relative within the week', () => {
        expect(sinceParts('2026-10-20T12:00:00Z', NOW)).toEqual({
            kind: 'relative',
            value: -3,
            unit: 'day'
        });
    });

    it('is a date after it, with the year only when it differs', () => {
        expect(sinceParts('2026-09-01T12:00:00Z', NOW)).toMatchObject({
            kind: 'date',
            withYear: false
        });
        expect(sinceParts('2025-09-01T12:00:00Z', NOW)).toMatchObject({
            kind: 'date',
            withYear: true
        });
    });

    it('reads a timestamp from the future as now', () => {
        expect(sinceParts('2026-10-23T12:05:00Z', NOW)).toEqual({
            kind: 'relative',
            value: 0,
            unit: 'minute'
        });
    });
});
