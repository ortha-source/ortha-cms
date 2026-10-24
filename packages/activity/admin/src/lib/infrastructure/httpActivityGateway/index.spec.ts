import { exportFileName } from './index';

describe('the export’s file name', () => {
    it('is read from the server’s Content-Disposition', () => {
        expect(
            exportFileName('attachment; filename="activity-2026-10-24.csv"')
        ).toBe('activity-2026-10-24.csv');
    });

    it('falls back to a plain name when the header says none', () => {
        expect(exportFileName(undefined)).toBe('activity.csv');
        expect(exportFileName('attachment')).toBe('activity.csv');
    });
});
