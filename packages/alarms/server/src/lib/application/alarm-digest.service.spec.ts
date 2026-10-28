import { digestPeriod } from './alarm-digest.service';

describe('digestPeriod', () => {
    const wednesday = new Date('2026-10-28T09:00:00.000Z');
    const monday = new Date('2026-11-02T09:00:00.000Z');

    it('is one period per UTC day for a daily digest', () => {
        expect(digestPeriod('daily', wednesday)).toEqual({
            key: '2026-10-28',
            lengthMs: 86_400_000
        });
    });

    it('is due on Mondays only for a weekly digest', () => {
        expect(digestPeriod('weekly', wednesday)).toBeNull();
        expect(digestPeriod('weekly', monday)).toEqual({
            key: 'week-2026-11-02',
            lengthMs: 7 * 86_400_000
        });
    });

    // The two keys can never collide, so switching daily ↔ weekly on a Monday
    // cannot swallow the other's period.
    it('keeps daily and weekly keys apart', () => {
        expect(digestPeriod('daily', monday)?.key).not.toBe(
            digestPeriod('weekly', monday)?.key
        );
    });

    it('is never due when switched off', () => {
        expect(digestPeriod('off', monday)).toBeNull();
    });
});
