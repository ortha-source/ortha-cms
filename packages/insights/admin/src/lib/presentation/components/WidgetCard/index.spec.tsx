import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { WidgetCard } from './index';

/**
 * The two decorations around the state ladder.
 *
 * The ladder itself — which of pending / error / empty / data is rendered, and
 * that `isError` outranks `isEmpty` — is pinned in `admin-e2e` against real
 * responses. What is not is the pair of claims about what sits *around* the
 * body: a chip asserting a figure the card has not loaded, and a closing line
 * interpreting a body that is not there. Both are props the widget always
 * passes, so only the card can suppress them, and no seeded response reaches
 * the pending branch long enough to look.
 */
const card = (props: Parameters<typeof WidgetCard>[0]) =>
    render(
        <IntlProvider locale="en">
            <WidgetCard {...props} />
        </IntlProvider>
    );

const base = {
    title: 'Gone quiet',
    action: <span>156 over a year</span>,
    footer: 'Older than a year, still published.',
    children: <span>the chart</span>
};

describe('WidgetCard decorations', () => {
    it('shows the chip and the caption once there is data [insights:I-12]', () => {
        card({ ...base });

        expect(screen.getByText('156 over a year')).toBeTruthy();
        expect(
            screen.getByText('Older than a year, still published.')
        ).toBeTruthy();
        expect(screen.getByText('the chart')).toBeTruthy();
    });

    it('suppresses both while the widget is loading [insights:I-12]', () => {
        card({ ...base, isPending: true });

        // "156 over a year" beside a skeleton asserts a number the widget has
        // not actually loaded — the chip has to wait for the figure behind it.
        expect(screen.queryByText('156 over a year')).toBeNull();
        expect(
            screen.queryByText('Older than a year, still published.')
        ).toBeNull();
        expect(screen.getByTestId('widget-skeleton')).toBeTruthy();
    });

    it('suppresses both when the request failed [insights:I-12]', () => {
        card({ ...base, isError: true });

        expect(screen.queryByText('156 over a year')).toBeNull();
        expect(
            screen.queryByText('Older than a year, still published.')
        ).toBeNull();
        expect(screen.getByRole('alert').textContent).toContain(
            "This didn't load"
        );
    });

    it('drops the caption on an empty period [insights:I-12]', () => {
        card({ ...base, isEmpty: true });

        // The caption interprets a body; with nothing plotted there is nothing
        // for it to be about, and it would read as a claim about no data.
        expect(
            screen.queryByText('Older than a year, still published.')
        ).toBeNull();
        expect(screen.getByRole('status').textContent).toContain(
            'Nothing to show for this period yet.'
        );
    });
});
