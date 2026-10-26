import { describe, expect, it } from 'vitest';
import { recencyOf } from '.';

/** A local wall-clock instant, so the calendar-day rules are deterministic. */
function at(day: number, hour: number, minute = 0): Date {
    return new Date(2026, 9, day, hour, minute);
}

describe('recencyOf', () => {
    const now = at(24, 10, 0);

    it.each([
        ['under a minute', new Date(now.getTime() - 30_000), { kind: 'now' }],
        ['twelve minutes', at(24, 9, 48), { kind: 'minutes', value: 12 }],
        ['an hour, today', at(24, 9, 0), { kind: 'hours', value: 1 }],
        ['early this morning', at(24, 0, 5), { kind: 'hours', value: 9 }],
        ['late last night', at(23, 23, 50), { kind: 'yesterday' }],
        ['three days', at(21, 15, 0), { kind: 'days', value: 3 }]
    ])('reads %s', (_label, date, expected) => {
        expect(recencyOf(date, now)).toEqual(expected);
    });

    it('falls back to the date after a week', () => {
        const date = at(1, 12, 0);
        expect(recencyOf(date, now)).toEqual({ kind: 'date', date });
    });

    it('treats a future timestamp (clock skew) as now', () => {
        expect(recencyOf(at(24, 10, 5), now)).toEqual({ kind: 'now' });
    });
});
