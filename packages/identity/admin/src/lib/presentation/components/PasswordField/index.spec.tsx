import { useState } from 'react';
import { IntlProvider } from 'react-intl';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PasswordField } from './index';

/** A controlled field, the way a form drives it. */
function Harness({
    meter = false,
    initial = '',
    error
}: {
    meter?: boolean;
    initial?: string;
    error?: string;
}) {
    const [value, setValue] = useState(initial);
    return (
        <IntlProvider locale="en" onError={() => undefined}>
            <PasswordField
                id="pw"
                label="Password"
                autoComplete="new-password"
                value={value}
                onChange={setValue}
                meter={meter}
                error={error}
            />
        </IntlProvider>
    );
}

/** The text an element's `aria-describedby` points at, as a reader hears it. */
function description(element: HTMLElement): string {
    return (element.getAttribute('aria-describedby') ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
        .trim();
}

describe('PasswordField', () => {
    it('masks the value until the toggle is pressed, and says so with aria-pressed', () => {
        render(<Harness initial="correct horse" />);
        const input = screen.getByLabelText('Password');
        const toggle = screen.getByRole('button', { name: 'Show password' });

        expect(input.getAttribute('type')).toBe('password');
        expect(toggle.getAttribute('aria-pressed')).toBe('false');

        fireEvent.click(toggle);

        expect(input.getAttribute('type')).toBe('text');
        // The name stays put; the state is what changes.
        expect(
            screen
                .getByRole('button', { name: 'Show password' })
                .getAttribute('aria-pressed')
        ).toBe('true');
    });

    it('is a plain button, so Enter in the field still submits its form', () => {
        render(<Harness />);
        expect(
            screen
                .getByRole('button', { name: 'Show password' })
                .getAttribute('type')
        ).toBe('button');
    });

    it('states the rule before anything is typed', () => {
        render(<Harness meter />);
        expect(description(screen.getByLabelText('Password'))).toBe(
            'At least 12 characters'
        );
    });

    it('describes the strength in words, which is what the bars draw', () => {
        render(<Harness meter />);
        const input = screen.getByLabelText('Password');

        fireEvent.change(input, { target: { value: 'correct horse battery' } });

        expect(description(input)).toBe('Strong · at least 12 characters');
        const meter = document.querySelector('[data-slot="password-strength"]');
        expect(meter?.getAttribute('aria-hidden')).toBe('true');
        expect(meter?.getAttribute('data-strength')).toBe('4');
    });

    it('calls a short password too short', () => {
        render(<Harness meter initial="abc" />);
        expect(description(screen.getByLabelText('Password'))).toBe(
            'Too short · at least 12 characters'
        );
    });

    it('marks itself invalid and announces an error', () => {
        render(<Harness error="That email and password don’t match." />);
        const input = screen.getByLabelText('Password');

        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(screen.getByRole('alert').textContent).toBe(
            'That email and password don’t match.'
        );
        expect(description(input)).toBe('That email and password don’t match.');
    });
});
