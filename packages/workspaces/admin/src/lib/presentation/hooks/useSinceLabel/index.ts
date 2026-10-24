import { useCallback } from 'react';
import { useIntl } from 'react-intl';
import { sinceParts } from '@orthacms/utils-admin';

/**
 * Formats "when" the way the cards say it: relative within a week ("12 min.
 * ago", "yesterday"), a short date beyond that ("Oct 18", with the year only
 * when it is not this one). Returns a formatter so a list formats every card
 * with one hook call.
 */
export function useSinceLabel(): (iso: string) => string {
    const intl = useIntl();
    return useCallback(
        (iso: string) => {
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
        },
        [intl]
    );
}
