import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { describe, expect, it, vi } from 'vitest';
import { MembersQuickFilters } from './index';

const COUNTS = { everyone: 7, active: 5, admins: 2, invited: 1, disabled: 1 };

describe('MembersQuickFilters', () => {
    it('presses exactly the active view and shows each count', () => {
        render(
            <IntlProvider locale="en">
                <MembersQuickFilters
                    value="invited"
                    counts={COUNTS}
                    onChange={() => undefined}
                />
            </IntlProvider>
        );
        const pressed = screen
            .getAllByRole('button')
            .filter((button) => button.getAttribute('aria-pressed') === 'true');
        expect(pressed.map((button) => button.textContent)).toEqual([
            'Invited1'
        ]);
        expect(
            screen.getByRole('button', { name: /^Everyone/ }).textContent
        ).toBe('Everyone7');
    });

    it('leaves the counts out until the list has answered', () => {
        render(
            <IntlProvider locale="en">
                <MembersQuickFilters
                    value="everyone"
                    onChange={() => undefined}
                />
            </IntlProvider>
        );
        expect(screen.getByRole('button', { name: 'Admins' })).toBeTruthy();
    });

    it('selects a view on click', () => {
        const onChange = vi.fn();
        render(
            <IntlProvider locale="en">
                <MembersQuickFilters
                    value="everyone"
                    counts={COUNTS}
                    onChange={onChange}
                />
            </IntlProvider>
        );
        fireEvent.click(screen.getByRole('button', { name: /^Disabled/ }));
        expect(onChange).toHaveBeenCalledWith('disabled');
    });
});
