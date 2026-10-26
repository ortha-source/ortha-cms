import { useCallback } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { recencyOf, type Recency } from '../../domain/recency';

/**
 * The four sentences a recency appears in. Each is one ICU `select` over the
 * bucket, so a translator sees the whole phrase ("Invited yesterday") rather
 * than a prefix glued onto a fragment.
 */
const messages = defineMessages({
    plain: {
        id: 'users.recency.plain',
        defaultMessage:
            '{kind, select, now {Now} minutes {{value} min ago} hours {{value} h ago} yesterday {Yesterday} days {{value} days ago} other {{date}}}'
    },
    active: {
        id: 'users.recency.active',
        defaultMessage:
            '{kind, select, now {Active now} minutes {Active {value} min ago} hours {Active {value} h ago} yesterday {Active yesterday} days {Active {value} days ago} other {Active {date}}}'
    },
    activeInline: {
        id: 'users.recency.activeInline',
        defaultMessage:
            '{kind, select, now {active now} minutes {active {value} min ago} hours {active {value} h ago} yesterday {active yesterday} days {active {value} days ago} other {active {date}}}'
    },
    invited: {
        id: 'users.recency.invited',
        defaultMessage:
            '{kind, select, now {Invited just now} minutes {Invited {value} min ago} hours {Invited {value} h ago} yesterday {Invited yesterday} days {Invited {value} days ago} other {Invited {date}}}'
    }
});

/** Which sentence the recency is set in. */
export type RecencyStyle = keyof typeof messages;

/**
 * Returns a formatter for "how long ago" in the roster's and the member page's
 * words: `format(date, 'plain')` → "12 min ago", `'active'` → "Active 12 min
 * ago", `'activeInline'` → "active 12 min ago", `'invited'` → "Invited
 * 2 days ago". Past a week it is the date — without the year inside the
 * current one ("Sep 30"), with it otherwise.
 */
export function useRecencyFormatter(): (
    date: Date,
    style?: RecencyStyle
) => string {
    const intl = useIntl();
    return useCallback(
        (date: Date, style: RecencyStyle = 'plain') => {
            const now = new Date();
            const recency: Recency = recencyOf(date, now);
            const formattedDate =
                recency.kind === 'date'
                    ? intl.formatDate(recency.date, {
                          month: 'short',
                          day: 'numeric',
                          year:
                              recency.date.getFullYear() === now.getFullYear()
                                  ? undefined
                                  : 'numeric'
                      })
                    : '';
            return intl.formatMessage(messages[style], {
                kind: recency.kind,
                value: 'value' in recency ? recency.value : 0,
                date: formattedDate
            });
        },
        [intl]
    );
}
