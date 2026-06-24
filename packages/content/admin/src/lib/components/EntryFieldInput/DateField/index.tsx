import { defineMessages, useIntl } from 'react-intl';
import { DatePicker, DateTimePicker } from '@ortha-cms/design-system';

const messages = defineMessages({
    datePlaceholder: {
        id: 'content.form.datePlaceholder',
        defaultMessage: 'Select date'
    },
    dateTimePlaceholder: {
        id: 'content.form.dateTimePlaceholder',
        defaultMessage: 'Select date & time'
    },
    time: { id: 'content.form.time', defaultMessage: 'Time' }
});

/** Zero-pads to two digits. */
function pad(n: number): string {
    return String(n).padStart(2, '0');
}

/** A `Date` → `YYYY-MM-DD` (local calendar date, no timezone shift). */
function toISODate(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A `Date` → `YYYY-MM-DDTHH:mm` (local, no timezone shift). */
function toISODateTime(date: Date): string {
    return `${toISODate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The field's ISO string → a local `Date`, or undefined. */
function parseValue(value: string): Date | undefined {
    const match =
        /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(
            value
        );
    if (!match) return undefined;
    const [, y, mo, d, h, mi, s] = match;
    return new Date(
        Number(y),
        Number(mo) - 1,
        Number(d),
        Number(h ?? 0),
        Number(mi ?? 0),
        Number(s ?? 0)
    );
}

/**
 * The control for a `date` / `datetime` field: a thin adapter over the
 * design-system {@link DatePicker} / {@link DateTimePicker} (single trigger; the
 * datetime variant carries the calendar + a time input as two sections of one
 * dropdown). Converts between the field's ISO string (`YYYY-MM-DD`, or
 * `YYYY-MM-DDTHH:mm` for datetime) and the picker's `Date`, with no timezone
 * shift.
 */
export function DateField({
    id,
    value,
    onChange,
    onBlur,
    withTime,
    invalid
}: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    withTime: boolean;
    invalid?: boolean;
}) {
    const intl = useIntl();
    const date = parseValue(value);

    if (withTime) {
        return (
            <DateTimePicker
                id={id}
                value={date}
                onChange={(next) => onChange(next ? toISODateTime(next) : '')}
                onBlur={onBlur}
                invalid={invalid}
                placeholder={intl.formatMessage(messages.dateTimePlaceholder)}
                timeLabel={intl.formatMessage(messages.time)}
            />
        );
    }

    return (
        <DatePicker
            id={id}
            value={date}
            onChange={(next) => onChange(next ? toISODate(next) : '')}
            onBlur={onBlur}
            invalid={invalid}
            placeholder={intl.formatMessage(messages.datePlaceholder)}
        />
    );
}
