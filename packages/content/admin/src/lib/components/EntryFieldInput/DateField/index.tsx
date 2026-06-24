import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ChevronDownIcon } from 'lucide-react';
import {
    Button,
    Calendar,
    Input,
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@ortha-cms/design-system';

const messages = defineMessages({
    placeholder: {
        id: 'content.form.datePlaceholder',
        defaultMessage: 'Select date'
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

/** The `YYYY-MM-DD` head of the value → a local `Date`, or undefined. */
function parseDatePart(value: string): Date | undefined {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!match) return undefined;
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d));
}

/**
 * The control for a `date` / `datetime` field, on the shadcn date-picker
 * patterns: a `Calendar` in a `Popover` behind an outline button (replacing the
 * native date input), and — for `datetime` — a `type="time"` `Input` beside it.
 * Owns no value: it reads/writes the field's ISO string (`YYYY-MM-DD`, or
 * `YYYY-MM-DDTHH:mm[:ss]` for datetime) via `value`/`onChange`, converting
 * to/from the calendar's `Date` without a timezone shift.
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
    const [open, setOpen] = useState(false);

    const date = parseDatePart(value);
    const time = withTime && value.includes('T') ? value.split('T')[1] : '';

    const commit = (nextDate: Date | undefined, nextTime: string) => {
        if (!nextDate) {
            onChange('');
            return;
        }
        const isoDate = toISODate(nextDate);
        onChange(withTime ? `${isoDate}T${nextTime || '00:00'}` : isoDate);
    };

    const dateLabel = date
        ? intl.formatDate(date, { dateStyle: 'long' })
        : intl.formatMessage(messages.placeholder);

    const picker = (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    data-empty={!date}
                    aria-invalid={invalid}
                    onBlur={onBlur}
                    className="w-full justify-between font-normal shadow-none hover:bg-background data-[empty=true]:text-muted-foreground"
                >
                    {dateLabel}
                    <ChevronDownIcon
                        className="size-4 opacity-50"
                        aria-hidden
                    />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                <Calendar
                    mode="single"
                    selected={date}
                    defaultMonth={date}
                    captionLayout="dropdown"
                    onSelect={(next) => {
                        commit(next, time);
                        if (!withTime) setOpen(false);
                    }}
                    autoFocus
                    className="p-4 [--cell-size:2.6rem]"
                />
            </PopoverContent>
        </Popover>
    );

    if (!withTime) return picker;

    return (
        <div className="flex gap-2">
            <div className="flex-1">{picker}</div>
            <Input
                type="time"
                step="1"
                value={time}
                aria-label={intl.formatMessage(messages.time)}
                aria-invalid={invalid}
                className="w-36 shadow-none [&::-webkit-calendar-picker-indicator]:hidden"
                onChange={(event) => commit(date, event.target.value)}
            />
        </div>
    );
}
