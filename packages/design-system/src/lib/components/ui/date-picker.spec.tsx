import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DatePicker, DateTimePicker } from './date-picker';

/**
 * QA ORT-49 · F14/F15, EC-10, EC-11 — `🐞 BUG-design-system-02`.
 *
 * `step="1"` on the time input invites seconds; the round trip through `HH:mm`
 * threw them away both on redisplay and whenever the day changed. A content
 * entry with a `publishedAt` datetime is the consumer, and no page test can see
 * a second hand.
 */
const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
    ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
        d.getMinutes()
    ).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

describe('DatePicker', () => {
    it('reads the placeholder and is marked empty when there is no value', () => {
        render(
            <DatePicker onChange={() => undefined} placeholder="Pick a day" />
        );

        const button = screen.getByRole('button');
        expect(button.textContent).toContain('Pick a day');
        expect(button.getAttribute('data-empty')).toBe('true');
    });

    it('formats the selected date onto the trigger', () => {
        render(
            <DatePicker
                value={new Date(2026, 2, 14)}
                onChange={() => undefined}
            />
        );

        const button = screen.getByRole('button');
        expect(button.getAttribute('data-empty')).toBe('false');
        expect(button.textContent).toContain('2026');
    });
});

describe('DateTimePicker', () => {
    const time = () => screen.getByLabelText('Time') as HTMLInputElement;

    async function openPicker(value?: Date, onChange = vi.fn()) {
        render(
            <DateTimePicker
                id="publishedAt"
                value={value}
                onChange={onChange}
            />
        );
        fireEvent.click(screen.getAllByRole('button')[0]);
        await waitFor(() => expect(time()).toBeTruthy());
        return onChange;
    }

    // BUG-design-system-02, first half: what the user typed must survive the
    // render that follows it.
    it('redisplays the seconds it was given', async () => {
        await openPicker(new Date(2026, 2, 14, 10, 30, 45));

        expect(time().value).toBe('10:30:45');
    });

    it('keeps the seconds a user types', async () => {
        const onChange = await openPicker(new Date(2026, 2, 14, 10, 30, 0));

        fireEvent.change(time(), { target: { value: '10:30:45' } });

        expect(iso(onChange.mock.calls[0][0] as Date)).toBe(
            '2026-03-14 10:30:45'
        );
    });

    // BUG-design-system-02, second half: changing the day must not re-zero the
    // seconds already stored.
    it('carries the whole time across a day change', async () => {
        const onChange = await openPicker(new Date(2026, 2, 14, 10, 30, 45));

        fireEvent.click(
            screen.getByRole('gridcell', { name: '20' })
                .firstChild as HTMLElement
        );

        await waitFor(() => expect(onChange).toHaveBeenCalled());
        expect(iso(onChange.mock.calls[0][0] as Date)).toBe(
            '2026-03-20 10:30:45'
        );
    });

    it('ignores a cleared time rather than coercing it to midnight', async () => {
        const onChange = await openPicker(new Date(2026, 2, 14, 10, 30, 45));

        fireEvent.change(time(), { target: { value: '' } });

        expect(onChange).not.toHaveBeenCalled();
    });

    it('renders an empty time input when there is no value', async () => {
        await openPicker(undefined);

        expect(time().value).toBe('');
    });
});
