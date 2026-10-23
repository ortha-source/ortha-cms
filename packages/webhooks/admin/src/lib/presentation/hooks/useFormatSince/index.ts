import { useIntl } from 'react-intl';
import { sinceParts } from '@orthacms/utils-admin';

/**
 * Formats when something was happened: relative within the week ("12 min
 * ago", "yesterday"), a short date after it ("Oct 20"), with the year only
 * when it is not this one.
 */
export function useFormatSince(): (iso: string) => string {
    const intl = useIntl();
    return (iso) => {
        const parts = sinceParts(iso);
        return parts.kind === 'relative'
            ? intl.formatRelativeTime(parts.value, parts.unit, {
                  numeric: 'auto',
                  style: 'short'
              })
            : intl.formatDate(parts.date, {
                  month: 'short',
                  day: 'numeric',
                  year: parts.withYear ? 'numeric' : undefined
              });
    };
}
