import { act, render, screen } from '@testing-library/react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTableUrlState } from '.';

const DEBOUNCE_MS = 300;

function Probe() {
    const navigate = useNavigate();
    const state = useTableUrlState({ searchKey: 'search', defaultPageSize: 25 });
    return (
        <div>
            <span data-testid="searchInput">{state.searchInput}</span>
            <span data-testid="searchParam">{state.searchParam}</span>
            <span data-testid="filterParam">{state.filterParam}</span>
            <span data-testid="page">{state.page}</span>
            <span data-testid="pageSize">{state.pageSize}</span>
            <span data-testid="searchPending">
                {String(state.searchPending)}
            </span>
            <span data-testid="url">
                {window.location.pathname + window.location.search}
            </span>
            <input
                aria-label="search"
                value={state.searchInput}
                onChange={(event) => state.setSearchInput(event.target.value)}
            />
            <button onClick={() => navigate('/users')}>to bare list</button>
            <button onClick={() => state.updateParams({ filter: 'role:admin' })}>
                set filter
            </button>
            <button
                onClick={() => state.updateParams({ page: '3' }, false)}
            >
                go to page 3
            </button>
        </div>
    );
}

function renderAt(url: string) {
    window.history.replaceState(null, '', url);
    return render(
        <BrowserRouter>
            <Probe />
        </BrowserRouter>
    );
}

function type(value: string) {
    const box = screen.getByLabelText('search') as HTMLInputElement;
    act(() => {
        const setter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value'
        )?.set;
        setter?.call(box, value);
        box.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

function settleDebounce() {
    act(() => {
        vi.advanceTimersByTime(DEBOUNCE_MS + 10);
    });
}

const at = (id: string) => screen.getByTestId(id).textContent;

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState(null, '', '/');
});

describe('useTableUrlState', () => {
    it('reads search, page and pageSize off the URL', () => {
        renderAt('/users?search=ada&page=2&pageSize=10');
        expect(at('searchParam')).toBe('ada');
        expect(at('searchInput')).toBe('ada');
        expect(at('page')).toBe('2');
        expect(at('pageSize')).toBe('10');
    });

    it.each([
        ['/users?page=abc', '1'],
        ['/users?page=0', '1'],
        ['/users?page=-1', '1'],
        ['/users?page=2.5', '1'],
        ['/users?page=', '1'],
        ['/users?page=Infinity', '1'],
        ['/users?page=1e3', '1000'],
        ['/users?page=%2010%20', '10']
    ])('reads %s as page %s', (url, expected) => {
        renderAt(url);
        expect(at('page')).toBe(expected);
    });

    it('passes an out-of-range pageSize straight through — the server clamps', () => {
        renderAt('/users?pageSize=100000');
        expect(at('pageSize')).toBe('100000');
    });

    it('treats the filter param as an opaque string', () => {
        renderAt('/users?filter=%7Bnot+json');
        expect(at('filterParam')).toBe('{not json');
    });

    it('debounces the search box into the URL once', () => {
        renderAt('/users');
        type('a');
        type('ad');
        type('ada');
        expect(at('searchParam')).toBe('');
        expect(at('searchPending')).toBe('true');

        settleDebounce();
        expect(at('searchParam')).toBe('ada');
        expect(at('url')).toBe('/users?search=ada');
        expect(at('searchPending')).toBe('false');
    });

    it('drops the param entirely when the box is cleared', () => {
        renderAt('/users?search=ada');
        type('');
        settleDebounce();
        expect(at('url')).toBe('/users');
    });

    // BUG-utils-admin-01 / A11Y-utils-admin-04 — the box initialised from the
    // URL once and an effect wrote it back forever after, so any navigation
    // that cleared the search (Back, or a link to the bare list) was silently
    // undone and the filter reappeared.
    it('re-syncs the box when the URL loses the search param', () => {
        renderAt('/users');
        type('ada');
        settleDebounce();
        expect(at('url')).toBe('/users?search=ada');

        act(() => {
            screen.getByText('to bare list').click();
        });
        settleDebounce();

        expect(at('searchInput')).toBe('');
        expect(at('searchParam')).toBe('');
        expect(at('url')).toBe('/users');
    });

    it('re-syncs the box when the URL changes the search param to another value', () => {
        renderAt('/users?search=ada');
        act(() => {
            window.history.pushState(null, '', '/users?search=grace');
            window.dispatchEvent(new PopStateEvent('popstate'));
        });
        settleDebounce();

        expect(at('searchInput')).toBe('grace');
        expect(at('searchParam')).toBe('grace');
        expect(at('url')).toBe('/users?search=grace');
    });

    it('does not clobber keystrokes that arrived while the debounce was in flight', () => {
        renderAt('/users');
        type('ada');
        settleDebounce();
        expect(at('searchParam')).toBe('ada');

        type('adam');
        // The URL still says `ada` at this instant; the box must keep `adam`.
        expect(at('searchInput')).toBe('adam');
        settleDebounce();
        expect(at('searchInput')).toBe('adam');
        expect(at('searchParam')).toBe('adam');
    });

    describe('updateParams', () => {
        it('merges, resets the page and replaces the history entry', () => {
            renderAt('/users?page=4');
            const lengthBefore = window.history.length;

            act(() => {
                screen.getByText('set filter').click();
            });

            expect(at('url')).toBe('/users?filter=role%3Aadmin');
            expect(at('page')).toBe('1');
            expect(window.history.length).toBe(lengthBefore);
        });

        it('keeps the page when resetPage is false', () => {
            renderAt('/users?search=ada');
            act(() => {
                screen.getByText('go to page 3').click();
            });
            expect(at('page')).toBe('3');
            expect(at('searchParam')).toBe('ada');
        });
    });
});
