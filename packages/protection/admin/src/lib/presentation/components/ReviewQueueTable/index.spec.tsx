import { fireEvent, render, screen, within } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { describe, expect, it, vi } from 'vitest';
import type { ReviewQueueItem } from '../../../domain/types';
import { ReviewQueueTable } from './index';

vi.mock('@orthacms/workspaces-admin', () => ({
    useCurrentWorkspace: () => ({
        id: 'ws',
        members: [
            { id: 'grace', name: 'Grace Hopper', initials: 'GH', email: 'g@x' },
            { id: 'me', name: 'Amara Okafor', initials: 'AO', email: 'a@x' }
        ]
    })
}));

const line = (over: Partial<ReviewQueueItem> = {}): ReviewQueueItem => ({
    id: 'r1',
    contentType: 'article',
    contentTypeLabel: 'Articles',
    entryId: 'e1',
    entryTitle: 'Pricing FAQ',
    requestedBy: 'grace',
    reviewerIds: ['me'],
    required: 2,
    given: 1,
    createdAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    headRevisionNumber: 5,
    liveRevisionNumber: 3,
    fieldsChanged: 3,
    ...over
});

const show = (items: ReviewQueueItem[], onReview = vi.fn()) => {
    render(
        <IntlProvider locale="en">
            <ReviewQueueTable
                items={items}
                currentUserId="me"
                overdueAfterDays={3}
                selectedId="r1"
                onReview={onReview}
            />
        </IntlProvider>
    );
    return onReview;
};

describe('ReviewQueueTable', () => {
    it('draws the board’s row: record over type and changes, first name, tally, age', () => {
        show([line()]);
        const row = screen.getAllByRole('row')[1];

        expect(within(row).getByText('Pricing FAQ')).toBeTruthy();
        expect(
            within(row).getByText('Articles · 3 fields changed')
        ).toBeTruthy();
        expect(within(row).getByText('Grace')).toBeTruthy();
        expect(row.textContent).toMatch(/1 of 2 approvals/);
        expect(within(row).getByText('5 days')).toBeTruthy();
        expect(within(row).getByText('Overdue')).toBeTruthy();
        expect(row.getAttribute('data-state')).toBe('selected');
    });

    it('leaves out a change count the server could not compute', () => {
        show([line({ fieldsChanged: null })]);
        expect(screen.getByText('Articles')).toBeTruthy();
        expect(screen.queryByText(/fields? changed/)).toBeNull();
    });

    it('opens the panel from Review, named for its row', () => {
        const onReview = show([line()]);
        fireEvent.click(
            screen.getByRole('button', { name: 'Review Pricing FAQ' })
        );
        expect(onReview).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'r1' }),
            expect.any(HTMLElement)
        );
    });
});
