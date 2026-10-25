import { defineMessages, type IntlShape } from 'react-intl';

/** Calendar days between two instants, in the reader's own timezone. */
export function daysBetween(at: Date, now: Date): number {
    const day = (d: Date) =>
        Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
    return day(now) - day(at);
}

/** The relative-day wordings of a When cell. */
const messages = defineMessages({
    today: { id: 'activity.when.today', defaultMessage: 'Today, {time}' },
    yesterday: {
        id: 'activity.when.yesterday',
        defaultMessage: 'Yesterday, {time}'
    }
});

/**
 * An event's time as the table's When cell says it — "Today, 10:42",
 * "Yesterday, 09:10", "Oct 22, 14:05". Total on an `Invalid Date`
 * (`activity:I-25`): `intl.formatTime`/`formatDate` render rather than throw,
 * and `daysBetween` of one is `NaN`, which falls through to the date form.
 */
export function formatActivityWhen(
    intl: IntlShape,
    at: Date,
    now: Date
): string {
    const time = intl.formatTime(at, { hour: '2-digit', minute: '2-digit' });
    const days = daysBetween(at, now);
    if (days === 0) return intl.formatMessage(messages.today, { time });
    if (days === 1) return intl.formatMessage(messages.yesterday, { time });
    return intl.formatDate(at, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
