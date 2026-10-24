import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';
import { NeedsAttentionCard } from './index';
import type { InsightsSignal } from '../../slots/insightsSlots';

const signal = (
    id: string,
    Component: InsightsSignal['Component']
): InsightsSignal => ({
    id,
    titleId: `t.${id}`,
    defaultTitle: id,
    Component,
    Drill: () => null
});

describe('NeedsAttentionCard', () => {
    let consoleError: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });
    afterEach(() => consoleError.mockRestore());

    it('hands each line its own opener and keeps the others when one throws [insights:I-13]', () => {
        const onOpen = vi.fn();
        render(
            <IntlProvider locale="en">
                <MemoryRouter>
                    <NeedsAttentionCard
                        openSignal="ok"
                        onOpen={onOpen}
                        signals={[
                            signal('ok', ({ onOpen, isOpen }) => (
                                <button type="button" onClick={onOpen}>
                                    ok line {isOpen ? 'open' : 'closed'}
                                </button>
                            )),
                            signal('broken', () => {
                                throw new Error('boom');
                            })
                        ]}
                    />
                </MemoryRouter>
            </IntlProvider>
        );

        expect(
            screen.getByRole('heading', { name: 'Needs attention', level: 3 })
        ).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'ok line open' }));
        expect(onOpen).toHaveBeenCalledWith('ok');
        // The throwing line is named and contained, inside the list.
        expect(screen.getByRole('alert').textContent).toContain(
            'stopped working'
        );
        expect(screen.getByText('broken')).toBeTruthy();
    });
});
