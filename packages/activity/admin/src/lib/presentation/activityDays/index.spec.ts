import type { IntlShape, MessageDescriptor } from 'react-intl';
import { daysBetween, formatActivityWhen } from './index';

/** Enough of an `IntlShape` to see which wording was chosen. */
const intl = {
    formatTime: () => '10:42',
    formatDate: () => 'Oct 22, 14:05',
    formatMessage: (
        descriptor: MessageDescriptor,
        values?: Record<string, string>
    ) =>
        String(descriptor.defaultMessage).replace(
            '{time}',
            values?.['time'] ?? ''
        )
} as unknown as IntlShape;

describe('the When cell', () => {
    const now = new Date(2026, 9, 24, 12, 0, 0);

    it('counts calendar days in the reader’s timezone, not 24-hour spans', () => {
        expect(daysBetween(new Date(2026, 9, 24, 0, 1), now)).toBe(0);
        expect(daysBetween(new Date(2026, 9, 23, 23, 59), now)).toBe(1);
        expect(daysBetween(new Date(2026, 9, 20, 12, 0), now)).toBe(4);
    });

    it('says Today, Yesterday, or the date with the time', () => {
        expect(
            formatActivityWhen(intl, new Date(2026, 9, 24, 10, 42), now)
        ).toBe('Today, 10:42');
        expect(
            formatActivityWhen(intl, new Date(2026, 9, 23, 10, 42), now)
        ).toBe('Yesterday, 10:42');
        expect(
            formatActivityWhen(intl, new Date(2026, 9, 22, 14, 5), now)
        ).toBe('Oct 22, 14:05');
    });

    it('does not throw on a timestamp the wire got wrong [activity:I-25]', () => {
        expect(formatActivityWhen(intl, new Date('not-a-date'), now)).toBe(
            'Oct 22, 14:05'
        );
    });
});
