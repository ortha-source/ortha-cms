import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';
import { Sheet, SheetContent } from '@orthacms/design-system';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaleEntriesDrill } from './index';
import { StaleEntriesSignal } from '../StaleEntriesSignal';

if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
        observe() {
            return undefined;
        }
        unobserve() {
            return undefined;
        }
        disconnect() {
            return undefined;
        }
    } as unknown as typeof ResizeObserver;
}

const hooks = vi.hoisted(() => ({
    stale: vi.fn(),
    staleRecords: vi.fn()
}));

vi.mock('../../../application/useContentInsights', () => ({
    useContentStale: hooks.stale,
    useContentStaleRecords: hooks.staleRecords
}));

vi.mock('@orthacms/workspaces-admin', () => ({
    useCurrentWorkspace: () => ({
        id: 'ws',
        name: 'Docs',
        members: [{ id: 'u1', name: 'Ada', initials: 'AL', color: 'violet' }]
    })
}));

const wrap = (children: ReactNode) => (
    <IntlProvider locale="en">
        <MemoryRouter>{children}</MemoryRouter>
    </IntlProvider>
);

const RECORDS = {
    total: 112,
    types: [
        { name: 'guide', label: 'Guides', count: 70 },
        { name: 'article', label: 'Articles', count: 42 }
    ],
    records: [
        {
            id: 'e1',
            type: 'guide',
            typeLabel: 'Guides',
            title: 'A guide to content modelling',
            updatedAt: '2024-08-02T10:00:00Z',
            editorId: 'u1'
        }
    ]
};

beforeEach(() => {
    hooks.stale.mockReset();
    hooks.staleRecords.mockReset();
});

describe('StaleEntriesSignal', () => {
    it('counts the over-a-year bucket and names the type most of it is in', () => {
        hooks.stale.mockReturnValue({
            data: {
                buckets: [
                    { id: 'd365', count: 9 },
                    { id: 'older', count: 112 }
                ],
                total: 121,
                olderTopType: { name: 'guide', label: 'Guides' }
            },
            isPending: false,
            isError: false
        });
        const onOpen = vi.fn();
        render(wrap(<StaleEntriesSignal onOpen={onOpen} isOpen={false} />));

        const line = screen.getByRole('button');
        expect(line.textContent).toContain('112');
        expect(line.textContent).toContain(
            'Not touched in over a year · most in Guides'
        );
        fireEvent.click(line);
        expect(onOpen).toHaveBeenCalled();
    });

    it('says it could not load rather than showing a zero', () => {
        hooks.stale.mockReturnValue({
            data: undefined,
            isPending: false,
            isError: true
        });
        render(wrap(<StaleEntriesSignal onOpen={vi.fn()} isOpen={false} />));
        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.getByRole('alert')).toBeTruthy();
    });
});

describe('StaleEntriesDrill', () => {
    const renderDrill = () =>
        render(
            wrap(
                <Sheet open>
                    <SheetContent>
                        <StaleEntriesDrill />
                    </SheetContent>
                </Sheet>
            )
        );

    it('opens on "Over a year" and lists the records with who touched them', () => {
        hooks.staleRecords.mockReturnValue({
            data: RECORDS,
            isPending: false,
            isError: false
        });
        renderDrill();

        expect(hooks.staleRecords).toHaveBeenLastCalledWith('year');
        expect(
            screen.getByRole('dialog', { name: 'Gone quiet · 112 records' })
        ).toBeTruthy();
        const row = screen.getByRole('link', {
            name: /A guide to content modelling/
        });
        expect(row.getAttribute('href')).toBe('/content/guide/e1');
        expect(row.textContent).toContain('Guides · last edited Aug 2024');
        expect(row.textContent).toContain('Last edited by Ada');
    });

    it('links each type’s records when the set spans several', () => {
        hooks.staleRecords.mockReturnValue({
            data: RECORDS,
            isPending: false,
            isError: false
        });
        renderDrill();
        expect(
            screen.getByRole('link', { name: 'Open 70 in Guides' })
        ).toBeTruthy();
        expect(
            screen.getByRole('link', { name: 'Open 42 in Articles' })
        ).toBeTruthy();
    });

    it('asks again for the band picked', () => {
        hooks.staleRecords.mockReturnValue({
            data: { total: 0, types: [], records: [] },
            isPending: false,
            isError: false
        });
        renderDrill();
        fireEvent.click(screen.getByRole('radio', { name: '3–12 months' }));
        expect(hooks.staleRecords).toHaveBeenLastCalledWith('months');
        expect(
            screen.getByText('Nothing published has gone this quiet.')
        ).toBeTruthy();
    });
});
