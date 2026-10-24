import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { Clock } from 'lucide-react';
import { SignalRow, type SignalRowProps } from './index';

const line = (props: Partial<SignalRowProps> = {}) => {
    const onOpen = vi.fn();
    render(
        <IntlProvider locale="en">
            <SignalRow
                icon={Clock}
                tone="bad"
                count={112}
                title="Gone quiet"
                hint="Not touched in over a year · most in Guides"
                onOpen={onOpen}
                isOpen={false}
                {...props}
            />
        </IntlProvider>
    );
    return onOpen;
};

describe('SignalRow', () => {
    it('is one button that opens the records behind the count', () => {
        const onOpen = line();
        const button = screen.getByRole('button', { name: /112.*Gone quiet/ });
        expect(button.getAttribute('aria-expanded')).toBe('false');
        expect(button.getAttribute('aria-haspopup')).toBe('dialog');
        fireEvent.click(button);
        expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it('says when its panel is the open one', () => {
        line({ isOpen: true });
        expect(
            screen.getByRole('button').getAttribute('aria-expanded')
        ).toBe('true');
    });

    it('never shows a count it could not load, and offers nothing to open', () => {
        line({ isError: true, count: 0 });
        // "0 gone quiet" and "we couldn't ask" are opposite facts.
        expect(screen.queryByText('0')).toBeNull();
        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.getByRole('alert').textContent).toContain(
            "Couldn't load"
        );
    });

    it('announces its loading state by name', () => {
        line({ isPending: true });
        expect(screen.getByRole('status').textContent).toContain(
            'Loading Gone quiet'
        );
        expect(screen.queryByRole('button')).toBeNull();
    });
});
