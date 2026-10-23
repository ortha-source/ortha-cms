import { useIntl } from 'react-intl';
import { relativeUnitSince } from '../../../domain/relativeTime';

/** Past this many days a save reads better as a date than as "40 days ago". */
const RELATIVE_DAYS = 7;

/**
 * Formats when something was last saved: relative within the week ("12 min
 * ago", "yesterday"), a short date after it ("Oct 20"), with the year only
 * when it is not this one.
 */
export function useFormatSince(): (iso: string) => string {
    const intl = useIntl();
    return (iso) => {
        const [value, unit] = relativeUnitSince(iso);
        if (unit !== 'day' || -value < RELATIVE_DAYS) {
            return intl.formatRelativeTime(value, unit, {
                numeric: 'auto',
                style: 'short'
            });
        }
        const date = new Date(iso);
        return intl.formatDate(date, {
            month: 'short',
            day: 'numeric',
            year:
                date.getFullYear() === new Date().getFullYear()
                    ? undefined
                    : 'numeric'
        });
    };
}
