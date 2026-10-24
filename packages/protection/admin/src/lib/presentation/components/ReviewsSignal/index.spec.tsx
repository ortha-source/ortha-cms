import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';
import { Sheet, SheetContent } from '@orthacms/design-system';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewsSignal } from './index';
import { ReviewsDrill } from '../ReviewsDrill';

const hooks = vi.hoisted(() => ({ insights: vi.fn(), queue: vi.fn() }));

vi.mock('../../../application/hooks', () => ({
    useProtectionInsights: hooks.insights,
    useReviewQueue: hooks.queue
}));

vi.mock('@orthacms/identity-admin', () => ({
    useHasPermission: () => true
}));

vi.mock('@orthacms/workspaces-admin', () => ({
    useCurrentWorkspace: () => ({
        id: 'ws',
        name: 'Docs',
        members: [{ id: 'u1', name: 'Mira', initials: 'MC', color: 'blue' }]
    })
}));

const wrap = (children: ReactNode) => (
    <IntlProvider locale="en">
        <MemoryRouter>{children}</MemoryRouter>
    </IntlProvider>
);

const days = (n: number) =>
    new Date(Date.now() - n * 24 * 60 * 60 * 1000 - 60_000).toISOString();

beforeEach(() => {
    hooks.insights.mockReset();
    hooks.queue.mockReset();
});

describe('ReviewsSignal', () => {
    it('names the longest-waiting overdue request', () => {
        hooks.insights.mockReturnValue({
            data: {
                open: 4,
                overdue: 1,
                overdueAfterDays: 3,
                oldestOpen: {
                    contentType: 'faq',
                    contentTypeLabel: 'FAQ',
                    entryId: 'e1',
                    entryTitle: 'Pricing FAQ',
                    waitingDays: 5
                }
            },
            isPending: false,
            isError: false
        });
        render(wrap(<ReviewsSignal onOpen={vi.fn()} isOpen={false} />));
        const line = screen.getByRole('button');
        expect(line.textContent).toContain('4');
        expect(line.textContent).toContain('1 overdue — Pricing FAQ, 5 days');
    });

    it('says nothing is overdue against the server’s own threshold', () => {
        hooks.insights.mockReturnValue({
            data: { open: 2, overdue: 0, overdueAfterDays: 3, oldestOpen: null },
            isPending: false,
            isError: false
        });
        render(wrap(<ReviewsSignal onOpen={vi.fn()} isOpen={false} />));
        expect(screen.getByRole('button').textContent).toContain(
            'None waiting longer than 3 days'
        );
    });

    it('never reads a failed load as an empty queue', () => {
        hooks.insights.mockReturnValue({
            data: undefined,
            isPending: false,
            isError: true
        });
        render(wrap(<ReviewsSignal onOpen={vi.fn()} isOpen={false} />));
        expect(screen.queryByText(/Nothing is waiting/)).toBeNull();
        expect(screen.getByRole('alert')).toBeTruthy();
    });
});

describe('ReviewsDrill', () => {
    it('lists the oldest ask first and leads to the Reviews queue', () => {
        hooks.queue.mockReturnValue({
            data: {
                total: 2,
                overdueAfterDays: 3,
                items: [
                    {
                        id: 'r2',
                        contentType: 'article',
                        contentTypeLabel: 'Articles',
                        entryId: 'e2',
                        entryTitle: 'Newer',
                        requestedBy: 'u1',
                        reviewerIds: [],
                        required: 1,
                        given: 0,
                        createdAt: days(1)
                    },
                    {
                        id: 'r1',
                        contentType: 'faq',
                        contentTypeLabel: 'FAQ',
                        entryId: 'e1',
                        entryTitle: 'Pricing FAQ',
                        requestedBy: 'u1',
                        reviewerIds: [],
                        required: 1,
                        given: 0,
                        createdAt: days(5)
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
                        <ReviewsDrill />
                    </SheetContent>
                </Sheet>
            )
        );

        const rows = screen
            .getAllByRole('link')
            .filter((link) => link.getAttribute('href')?.includes('/content/'));
        expect(rows[0].textContent).toContain('Pricing FAQ');
        expect(rows[0].textContent).toContain('FAQ · waiting 5 days · overdue');
        expect(rows[0].textContent).toContain('Requested by Mira');
        expect(rows[1].textContent).toContain('Newer');
        expect(
            screen
                .getByRole('link', { name: 'Open all 2 in Reviews' })
                .getAttribute('href')
        ).toBe('/reviews');
    });
});
