import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FieldError } from './field';
import { InputField } from './input-field';

/**
 * QA ORT-49 · F4/F5, EC-01, EC-02 — `🐞 BUG-design-system-05`.
 *
 * Every admin form in the repo funnels its validation copy through this one
 * component, so the two seams below decide whether a user is told why a submit
 * failed: whether an explicit `invalid={false}` may swallow a real message, and
 * whether an empty error list still opens a `role="alert"`. Neither is
 * observable from a page test — the pages that mount `InputField` never pass
 * those combinations — which is why they are pinned here.
 */
describe('InputField', () => {
    const email = () => screen.getByLabelText('Email');

    it('labels the control and wires the label to it', () => {
        render(<InputField id="email" label="Email" />);
        expect(email().id).toBe('email');
    });

    it('describes the control with the hint and the error, hint first', () => {
        render(
            <InputField
                id="email"
                label="Email"
                description="We never share it."
                error="Email is required"
            />
        );

        expect(email().getAttribute('aria-describedby')).toBe(
            'email-description email-error'
        );
    });

    it('appends a consumer aria-describedby rather than replacing it', () => {
        render(
            <InputField
                id="email"
                label="Email"
                error="Email is required"
                aria-describedby="extra-hint"
            />
        );

        expect(email().getAttribute('aria-describedby')).toBe(
            'email-error extra-hint'
        );
    });

    it('derives aria-invalid from the presence of an error', () => {
        const { rerender } = render(<InputField id="email" label="Email" />);
        expect(email().getAttribute('aria-invalid')).toBe('false');

        rerender(<InputField id="email" label="Email" error="Nope" />);
        expect(email().getAttribute('aria-invalid')).toBe('true');
    });

    it('lets an explicit invalid override the derived value', () => {
        render(<InputField id="email" label="Email" invalid />);
        expect(email().getAttribute('aria-invalid')).toBe('true');
    });

    // BUG-design-system-05, first half: the message is the only thing telling
    // the user what to fix, so `invalid` must not be able to swallow it.
    it('still renders a supplied error when invalid={false} is passed', () => {
        render(
            <InputField id="email" label="Email" invalid={false} error="Nope" />
        );

        expect(screen.getByRole('alert').textContent).toBe('Nope');
    });

    // BUG-design-system-05, second half (EC-01).
    it('renders no alert for an empty errors array', () => {
        render(<InputField id="email" label="Email" invalid errors={[]} />);

        expect(screen.queryByRole('alert')).toBeNull();
    });

    // EC-02.
    it('renders no alert when every error entry is message-less', () => {
        render(
            <InputField
                id="email"
                label="Email"
                invalid
                errors={[{}, undefined]}
            />
        );

        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('does not describe the control with an error id it never rendered', () => {
        render(<InputField id="email" label="Email" invalid errors={[]} />);

        expect(email().getAttribute('aria-describedby')).toBeNull();
    });

    it('renders the single error message without a list wrapper', () => {
        render(
            <InputField
                id="email"
                label="Email"
                errors={[{ message: 'Email is required' }]}
            />
        );

        const alert = screen.getByRole('alert');
        expect(alert.textContent).toBe('Email is required');
        expect(alert.querySelector('ul')).toBeNull();
    });

    it('lists several error messages', () => {
        render(
            <InputField
                id="email"
                label="Email"
                errors={[{ message: 'Too short' }, { message: 'Not an email' }]}
            />
        );

        expect(
            screen.getAllByRole('listitem').map((li) => li.textContent)
        ).toEqual(['Too short', 'Not an email']);
    });
});

describe('FieldError', () => {
    it('renders nothing when there is neither children nor errors', () => {
        const { container } = render(<FieldError />);
        expect(container.innerHTML).toBe('');
    });

    // EC-01 at the primitive.
    it('renders nothing for an empty errors array', () => {
        const { container } = render(<FieldError errors={[]} />);
        expect(container.innerHTML).toBe('');
    });

    // EC-02 at the primitive.
    it('renders nothing when no entry carries a message', () => {
        const { container } = render(<FieldError errors={[{}, undefined]} />);
        expect(container.innerHTML).toBe('');
    });

    it('prefers children over errors', () => {
        render(
            <FieldError errors={[{ message: 'from errors' }]}>
                from children
            </FieldError>
        );
        expect(screen.getByRole('alert').textContent).toBe('from children');
    });
});
