'use client';

import * as React from 'react';
import { ChevronDownIcon, ClockIcon } from 'lucide-react';
import { getDefaultClassNames } from 'react-day-picker';

import { cn } from '../../utils';
import { Button } from './button';
import { Calendar } from './calendar';
import { Input } from './input';
import { Label } from './label';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

/**
 * Day-cell size — small enough that all 7 columns (each `min-w-[--cell-size]`)
 * fit inside the capped 300px popover without overflowing.
 */
const CALENDAR_STYLE = { '--cell-size': '2.25rem' } as React.CSSProperties;

/** Make the calendar fill its popover (which is sized to the trigger). */
const CALENDAR_CLASS_NAMES = {
    root: cn('w-full', getDefaultClassNames().root)
};

/** Popover sized to the field, capped so it never gets unwieldy. */
const POPOVER_CLASS =
    'w-[var(--radix-popover-trigger-width)] max-w-[300px] p-0';

/**
 * `HH:mm:ss` of a date. Seconds are kept, not truncated: the time input runs at
 * `step="1"`, which invites them, and a round trip through `HH:mm` used to
 * discard whatever the user typed — both on the very next render and again
 * whenever the day changed underneath.
 */
function timeOf(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
        date.getSeconds()
    )}`;
}

/** Returns a copy of `date` with the `HH:mm[:ss]` applied. */
function withTimeOf(date: Date, time: string): Date {
    const [h, m, s] = time.split(':').map(Number);
    const next = new Date(date);
    next.setHours(h || 0, m || 0, s || 0, 0);
    return next;
}

type DatePickerProps = {
    /** Selected date, or undefined when empty. */
    value?: Date;
    /** Called with the next date (or undefined when cleared). */
    onChange: (value: Date | undefined) => void;
    /** Trigger text when nothing is selected. */
    placeholder?: string;
    id?: string;
    invalid?: boolean;
    disabled?: boolean;
    onBlur?: () => void;
    /** Ids of the hint/error elements describing the trigger. */
    'aria-describedby'?: string;
    className?: string;
};

/**
 * A single-date picker: a full-width outline trigger showing the formatted date
 * (browser locale), opening a `Calendar` popover. Controlled via `value`/
 * `onChange` (a `Date`). i18n-free — pass a localized `placeholder`.
 */
function DatePicker({
    value,
    onChange,
    placeholder = 'Pick a date',
    id,
    invalid,
    disabled,
    onBlur,
    'aria-describedby': ariaDescribedby,
    className
}: DatePickerProps) {
    const [open, setOpen] = React.useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    data-empty={!value}
                    aria-invalid={invalid}
                    aria-describedby={ariaDescribedby}
                    disabled={disabled}
                    onBlur={onBlur}
                    className={cn(
                        'w-full justify-between font-normal shadow-none hover:bg-background data-[empty=true]:text-muted-foreground aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive',
                        className
                    )}
                >
                    {value
                        ? value.toLocaleDateString(undefined, {
                              dateStyle: 'long'
                          })
                        : placeholder}
                    <ChevronDownIcon
                        className="size-4 opacity-50"
                        aria-hidden
                    />
                </Button>
            </PopoverTrigger>
            <PopoverContent className={POPOVER_CLASS} align="start">
                <Calendar
                    mode="single"
                    selected={value}
                    defaultMonth={value}
                    captionLayout="dropdown"
                    autoFocus
                    className="w-full p-4"
                    classNames={CALENDAR_CLASS_NAMES}
                    style={CALENDAR_STYLE}
                    onSelect={(next) => {
                        onChange(next);
                        setOpen(false);
                    }}
                />
            </PopoverContent>
        </Popover>
    );
}

type DateTimePickerProps = DatePickerProps & {
    /** Label for the time section inside the dropdown. */
    timeLabel?: string;
};

/**
 * A single date-and-time field: one trigger (formatted date + time) opening a
 * popover with **two sections** — a `Calendar` for the date and, below a
 * separator, a time input. Picking a day keeps the current time; editing the
 * time keeps the day (defaulting to today if none is set yet). Controlled via a
 * single `Date` `value`/`onChange`. i18n-free — pass localized labels.
 */
function DateTimePicker({
    value,
    onChange,
    placeholder = 'Pick date & time',
    timeLabel = 'Time',
    id,
    invalid,
    disabled,
    onBlur,
    'aria-describedby': ariaDescribedby,
    className
}: DateTimePickerProps) {
    const [open, setOpen] = React.useState(false);
    const timeId = id ? `${id}-time` : undefined;

    const setDate = (day: Date | undefined) => {
        if (!day) {
            onChange(undefined);
            return;
        }
        onChange(value ? withTimeOf(day, timeOf(value)) : day);
    };

    const setTime = (time: string) => {
        // A native time input yields '' when cleared. A datetime always needs a
        // time, so ignore an empty value rather than coercing it to midnight.
        if (!time) return;
        onChange(withTimeOf(value ?? new Date(), time));
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    data-empty={!value}
                    aria-invalid={invalid}
                    aria-describedby={ariaDescribedby}
                    disabled={disabled}
                    onBlur={onBlur}
                    className={cn(
                        'w-full justify-between font-normal shadow-none hover:bg-background data-[empty=true]:text-muted-foreground aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive',
                        className
                    )}
                >
                    {value
                        ? value.toLocaleString(undefined, {
                              dateStyle: 'long',
                              timeStyle: 'short'
                          })
                        : placeholder}
                    <ChevronDownIcon
                        className="size-4 opacity-50"
                        aria-hidden
                    />
                </Button>
            </PopoverTrigger>
            <PopoverContent className={POPOVER_CLASS} align="start">
                <Calendar
                    mode="single"
                    selected={value}
                    defaultMonth={value}
                    captionLayout="dropdown"
                    autoFocus
                    className="w-full p-4"
                    classNames={CALENDAR_CLASS_NAMES}
                    style={CALENDAR_STYLE}
                    onSelect={setDate}
                />
                <div className="flex items-center gap-3 border-t p-3">
                    <Label
                        htmlFor={timeId}
                        className="flex items-center gap-1.5 text-muted-foreground"
                    >
                        <ClockIcon className="size-4" aria-hidden />
                        {timeLabel}
                    </Label>
                    <Input
                        id={timeId}
                        type="time"
                        step="1"
                        value={value ? timeOf(value) : ''}
                        aria-label={timeLabel}
                        className="w-auto flex-1 shadow-none [&::-webkit-calendar-picker-indicator]:hidden"
                        onChange={(event) => setTime(event.target.value)}
                    />
                </div>
            </PopoverContent>
        </Popover>
    );
}

export { DatePicker, DateTimePicker };
export type { DatePickerProps, DateTimePickerProps };
