import { denseSeries } from '.';

const NOW = new Date('2026-10-23T15:00:00Z'); // a Friday

describe('denseSeries', () => {
    it('fills every day of the window, quiet ones at zero', () => {
        const series = denseSeries(
            [
                { bucket: '2026-10-20', value: 4 },
                { bucket: '2026-10-23', value: 2 }
            ],
            'day',
            7,
            NOW
        );
        expect(series.map((point) => point.bucket)).toEqual([
            '2026-10-16',
            '2026-10-17',
            '2026-10-18',
            '2026-10-19',
            '2026-10-20',
            '2026-10-21',
            '2026-10-22',
            '2026-10-23'
        ]);
        expect(series.map((point) => point.value)).toEqual([
            0, 0, 0, 0, 4, 0, 0, 2
        ]);
    });

    it('steps weeks from Monday, as the server truncates them', () => {
        const series = denseSeries(
            [{ bucket: '2026-10-05', value: 3 }],
            'week',
            21,
            NOW
        );
        expect(series.map((point) => point.bucket)).toEqual([
            '2026-09-28',
            '2026-10-05',
            '2026-10-12',
            '2026-10-19'
        ]);
        expect(series[1].value).toBe(3);
    });

    it('steps months from the first', () => {
        const series = denseSeries([], 'month', 90, NOW);
        expect(series.map((point) => point.bucket)).toEqual([
            '2026-07-01',
            '2026-08-01',
            '2026-09-01',
            '2026-10-01'
        ]);
    });

    it('never drops a bucket the server sent, so the total holds', () => {
        const series = denseSeries(
            [{ bucket: '2020-01-01', value: 9 }],
            'day',
            1,
            NOW
        );
        expect(series.reduce((sum, point) => sum + point.value, 0)).toBe(9);
    });
});
