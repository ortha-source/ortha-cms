import { ageParts, inlineTypeLabel, previewVerdict } from './index';

/**
 * The editor's one judgement — "this flags everything, the condition is
 * probably inverted" — and the arithmetic around it.
 */
describe('previewVerdict', () => {
    const sample = [{}, {}, {}, {}];

    it('calls every record matching an inverted condition', () => {
        expect(previewVerdict({ matched: 842, total: 842, sample })).toEqual({
            inverted: true,
            more: 838
        });
    });

    it('does not call a partial match inverted', () => {
        expect(previewVerdict({ matched: 38, total: 842, sample })).toEqual({
            inverted: false,
            more: 34
        });
    });

    it('does not call an empty collection inverted — zero of zero is no signal', () => {
        expect(
            previewVerdict({ matched: 0, total: 0, sample: [] }).inverted
        ).toBe(false);
    });

    it('never counts "more" below zero', () => {
        expect(previewVerdict({ matched: 2, total: 9, sample }).more).toBe(0);
    });
});

describe('inlineTypeLabel', () => {
    it('lowers a capitalised word for use mid-sentence', () => {
        expect(inlineTypeLabel('Articles')).toBe('articles');
    });

    it('leaves an acronym or a single letter as written', () => {
        expect(inlineTypeLabel('FAQ entries')).toBe('FAQ entries');
        expect(inlineTypeLabel('X')).toBe('X');
    });
});

describe('ageParts', () => {
    const now = Date.parse('2026-10-24T12:00:00.000Z');
    const ago = (ms: number) => new Date(now - ms).toISOString();
    const DAY = 86_400_000;

    it('says how long ago, always relatively', () => {
        expect(ageParts(ago(8 * 60_000), now)).toEqual([-8, 'minute']);
        expect(ageParts(ago(3 * 3_600_000), now)).toEqual([-3, 'hour']);
        expect(ageParts(ago(3 * DAY), now)).toEqual([-3, 'day']);
        expect(ageParts(ago(14 * DAY), now)).toEqual([-2, 'week']);
        expect(ageParts(ago(90 * DAY), now)).toEqual([-3, 'month']);
        expect(ageParts(ago(800 * DAY), now)).toEqual([-2, 'year']);
    });

    it('reads a future timestamp (clock skew) as now', () => {
        expect(ageParts(ago(-5 * 60_000), now)).toEqual([-0, 'minute']);
    });
});
