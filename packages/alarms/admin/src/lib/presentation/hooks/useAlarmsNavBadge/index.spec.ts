import { alarmsBadgeOf } from './index';

const summary = (error: number, warn: number, info: number) => ({
    open: { error, warn, info },
    openTotal: error + warn + info
});

describe('alarmsBadgeOf', () => {
    it('says nothing before the summary arrives', () => {
        expect(alarmsBadgeOf(undefined)).toBeNull();
    });

    it('counts errors and warnings, toned by the worst one open', () => {
        expect(alarmsBadgeOf(summary(1, 2, 5))).toEqual({
            count: 3,
            worst: 'error'
        });
        expect(alarmsBadgeOf(summary(0, 2, 0))).toEqual({
            count: 2,
            worst: 'warn'
        });
    });

    // `info` is an alarm saying something without asking anyone to act; a
    // navigation chip is exactly that ask.
    it('never asks for attention over info findings alone', () => {
        expect(alarmsBadgeOf(summary(0, 0, 7))).toBeNull();
    });
});
