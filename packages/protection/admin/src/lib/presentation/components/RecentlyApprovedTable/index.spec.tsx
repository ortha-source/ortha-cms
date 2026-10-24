import { render, screen, within } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { describe, expect, it, vi } from 'vitest';
import type { RecentlyApprovedItem } from '../../../domain/types';
import { RecentlyApprovedTable } from './index';

vi.mock('@orthacms/workspaces-admin', () => ({
    useCurrentWorkspace: () => ({
        id: 'ws',
        members: [
            { id: 'grace', name: 'Grace Hopper', initials: 'GH', email: 'g@x' }
        ]
    })
}));

const line = (
    over: Partial<RecentlyApprovedItem> = {}
): RecentlyApprovedItem => ({
    id: 'e1',
    contentType: 'article',
    contentTypeLabel: 'Articles',
    entryId: 'e1',
    entryTitle: 'Pricing FAQ',
    requestedBy: 'grace',
    reviewerIds: ['me'],
    required: 2,
    given: 2,
    approvedAt: new Date(Date.now() - 86_400_000).toISOString(),
    approvalCurrent: true,
    headPublished: false,
    headRevisionNumber: 5,
    liveRevisionNumber: 3,
    fieldsChanged: 3,
    ...over
});

const rowOf = (items: RecentlyApprovedItem[]) => {
    render(
        <IntlProvider locale="en">
            <RecentlyApprovedTable
                items={items}
                currentUserId="me"
                onReview={() => undefined}
            />
        </IntlProvider>
    );
    return screen.getAllByRole('row')[1];
};

/** Where an approval stands now — in words, not a tint. */
describe('RecentlyApprovedTable', () => {
    it('says an approval on the current version still counts, and when it was given', () => {
        const row = rowOf([line()]);
        expect(within(row).getByText('Still counts')).toBeTruthy();
        expect(within(row).getByText('yesterday')).toBeTruthy();
    });

    it('says a record that went live with it is published', () => {
        const row = rowOf([line({ headPublished: true })]);
        expect(within(row).getByText('Published')).toBeTruthy();
    });

    it('says a save moved past it', () => {
        const row = rowOf([line({ approvalCurrent: false })]);
        expect(within(row).getByText('Changed since')).toBeTruthy();
    });

    it('says nobody asked, rather than leaving the cell blank', () => {
        const row = rowOf([line({ requestedBy: null, reviewerIds: [] })]);
        expect(within(row).getByText('Nobody asked')).toBeTruthy();
    });
});
