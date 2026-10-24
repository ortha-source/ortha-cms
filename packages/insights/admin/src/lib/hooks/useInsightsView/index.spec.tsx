import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router-dom';
import { useInsightsView } from './index';

/**
 * The tab and drill-down halves of the page's URL contract: written with
 * `replace`, merged into whatever else is in the query string (the range,
 * above all), and the first tab left out.
 */
function Probe() {
    const view = useInsightsView({
        tabs: ['overview', 'content', 'team'],
        signals: ['content.stale']
    });
    const location = useLocation();
    const navigationType = useNavigationType();
    return (
        <div>
            <span data-testid="tab">{view.tab}</span>
            <span data-testid="signal">{view.signal ?? 'none'}</span>
            <span data-testid="search">{location.search}</span>
            <span data-testid="nav">{navigationType}</span>
            <button type="button" onClick={() => view.setTab('team')}>
                team
            </button>
            <button type="button" onClick={() => view.setTab('overview')}>
                overview
            </button>
            <button
                type="button"
                onClick={() => view.setSignal('content.stale')}
            >
                open
            </button>
            <button type="button" onClick={() => view.setSignal(null)}>
                close
            </button>
        </div>
    );
}

const text = (id: string) => screen.getByTestId(id).textContent;

describe('useInsightsView', () => {
    it('switches tabs by replacing, keeping the range', () => {
        render(
            <MemoryRouter initialEntries={['/insights?range=90d']}>
                <Probe />
            </MemoryRouter>
        );
        expect(text('tab')).toBe('overview');

        fireEvent.click(screen.getByText('team'));
        expect(text('tab')).toBe('team');
        expect(text('search')).toBe('?range=90d&tab=team');
        expect(text('nav')).toBe('REPLACE');

        // Back to the first tab drops the param rather than writing it.
        fireEvent.click(screen.getByText('overview'));
        expect(text('search')).toBe('?range=90d');
    });

    it('opens and closes a drill-down through the URL', () => {
        render(
            <MemoryRouter initialEntries={['/insights?tab=content']}>
                <Probe />
            </MemoryRouter>
        );
        fireEvent.click(screen.getByText('open'));
        expect(text('signal')).toBe('content.stale');
        expect(text('search')).toBe('?tab=content&signal=content.stale');

        fireEvent.click(screen.getByText('close'));
        expect(text('signal')).toBe('none');
        expect(text('search')).toBe('?tab=content');
    });

    it('ignores a drill-down the reader cannot see', () => {
        render(
            <MemoryRouter initialEntries={['/insights?signal=media.alt']}>
                <Probe />
            </MemoryRouter>
        );
        expect(text('signal')).toBe('none');
    });
});
