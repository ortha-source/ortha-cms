import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { Sheet, SheetContent } from '@orthacms/design-system';
import { SignalDrill, type SignalDrillProps } from './index';

/** The shell renders the dialog's own title, so it lives inside a sheet. */
const drill = (props: Partial<SignalDrillProps> = {}) =>
    render(
        <IntlProvider locale="en">
            <Sheet open>
                <SheetContent>
                    <SignalDrill
                        title="Gone quiet"
                        count={112}
                        shown={2}
                        description="Published records nobody has touched."
                        actions={<button type="button">Open all</button>}
                        {...props}
                    >
                        <li>A guide to content modelling</li>
                        <li>Localising a site in a week</li>
                    </SignalDrill>
                </SheetContent>
            </Sheet>
        </IntlProvider>
    );

describe('SignalDrill', () => {
    it('names the panel by the signal and its true count', () => {
        drill();
        expect(
            screen.getByRole('dialog', { name: 'Gone quiet · 112 records' })
        ).toBeTruthy();
        expect(screen.getByText('A guide to content modelling')).toBeTruthy();
        // Two of 112 listed — the panel says so rather than implying all.
        expect(
            screen.getByText('Showing the oldest 2 of 112.')
        ).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Open all' })).toBeTruthy();
    });

    it('names the signal alone while the count is unknown', () => {
        drill({ count: undefined, isPending: true });
        expect(screen.getByRole('dialog', { name: 'Gone quiet' })).toBeTruthy();
        expect(screen.getByTestId('drill-skeleton')).toBeTruthy();
    });

    it('tells a failure from an empty list [insights:I-10]', () => {
        drill({ isError: true, isEmpty: true });
        expect(screen.getByRole('alert').textContent).toContain(
            "didn't load"
        );
        expect(screen.queryByText('Nothing here right now.')).toBeNull();
        expect(screen.queryByText('A guide to content modelling')).toBeNull();
    });

    it('says when nothing matches', () => {
        drill({ isEmpty: true, count: 0 });
        expect(screen.getByText('Nothing here right now.')).toBeTruthy();
    });
});
