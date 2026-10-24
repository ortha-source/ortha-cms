import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';
import { Sheet, SheetContent } from '@orthacms/design-system';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnshippedChangesDrill } from './index';
import { UnshippedChangesSignal } from '../UnshippedChangesSignal';

const hooks = vi.hoisted(() => ({
    unshipped: vi.fn(),
    records: vi.fn()
}));

vi.mock('../../../application/useContentInsights', () => ({
    useContentUnshipped: hooks.unshipped,
    useContentUnshippedRecords: hooks.records
}));

vi.mock('@orthacms/workspaces-admin', () => ({
    useCurrentWorkspace: () => ({ id: 'ws', name: 'Docs', members: [] })
}));

const wrap = (children: ReactNode) => (
    <IntlProvider locale="en">
        <MemoryRouter>{children}</MemoryRouter>
    </IntlProvider>
);

beforeEach(() => {
    hooks.unshipped.mockReset();
    hooks.records.mockReset();
});

describe('UnshippedChangesSignal', () => {
    it('counts modified records as a share of live ones', () => {
        hooks.unshipped.mockReturnValue({
            data: { types: [], modified: 37, live: 1850, neverPublished: 4 },
            isPending: false,
            isError: false
        });
        render(wrap(<UnshippedChangesSignal onOpen={vi.fn()} isOpen />));
        const line = screen.getByRole('button');
        expect(line.textContent).toContain('37');
        expect(line.textContent).toContain(
            'Published records with edits nobody has published · 2% of live'
        );
        expect(line.getAttribute('aria-expanded')).toBe('true');
    });
});

describe('UnshippedChangesDrill', () => {
    it('opens one type’s Modified records when the set sits in one type', () => {
        hooks.records.mockReturnValue({
            data: {
                total: 1,
                types: [{ name: 'article', label: 'Articles', count: 1 }],
                records: [
                    {
                        id: 'e1',
                        type: 'article',
                        typeLabel: 'Articles',
                        title: null,
                        updatedAt: '2026-10-01T10:00:00Z',
                        editorId: 'gone'
                    }
                ]
            },
            isPending: false,
            isError: false
        });
        render(
            wrap(
                <Sheet open>
                    <SheetContent>
                        <UnshippedChangesDrill />
                    </SheetContent>
                </Sheet>
            )
        );

        // An untitled record is named by its id, a departed editor as such.
        const row = screen.getByRole('link', { name: /Untitled \(e1\)/ });
        expect(row.textContent).toContain('A former member');
        const all = screen.getByRole('link', {
            name: 'Open all 1 in Records'
        });
        const href = all.getAttribute('href') ?? '';
        expect(href.startsWith('/content/article?filter=')).toBe(true);
        expect(decodeURIComponent(href)).toContain('"publishedAt"');
    });
});
