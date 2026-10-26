import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntryReview } from '../../../domain/types';
import { ReviewPanel, type ReviewPanelItem } from './index';

const getEntryReview = vi.fn();
const approve = vi.fn();
let canApprove = true;

vi.mock('../../../infrastructure/protectionGateway', () => ({
    httpProtectionGateway: {
        getEntryReview: (...args: unknown[]) => getEntryReview(...args),
        approve: (...args: unknown[]) => approve(...args)
    }
}));

vi.mock('@orthacms/workspaces-admin', () => ({
    useCurrentWorkspace: () => ({
        id: 'ws',
        members: [
            { id: 'me', name: 'Amara Okafor', initials: 'AO', email: 'a@x' },
            { id: 'grace', name: 'Grace Hopper', initials: 'GH', email: 'g@x' },
            { id: 'ada', name: 'Ada Lovelace', initials: 'AL', email: 'l@x' }
        ]
    })
}));

vi.mock('@orthacms/identity-admin', () => ({
    useAuth: () => ({ user: { id: 'me' } }),
    useHasPermission: () => canApprove
}));

// The diff is content's own component's business and has its own reads; the
// panel is pinned here on what it decides itself.
vi.mock('../ReviewChanges', () => ({
    ReviewChanges: (props: { headNumber: number; liveNumber: number }) => (
        <p>
            changes v{props.liveNumber}→v{props.headNumber}
        </p>
    )
}));

// jsdom implements none of the browser APIs Radix's dialog reaches for.
if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false
    })) as typeof window.matchMedia;
}

const DAY = 86_400_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

const ITEM: ReviewPanelItem = {
    key: 'r1',
    contentType: 'article',
    contentTypeLabel: 'Articles',
    entryId: 'e1',
    entryTitle: 'Pricing FAQ',
    askedAt: ago(5 * DAY),
    headRevisionNumber: 5,
    liveRevisionNumber: 3
};

/** The board's state: Grace asked me and Ada, Ada approved yesterday. */
const review = (over: Partial<EntryReview> = {}): EntryReview => ({
    protected: true,
    required: 2,
    given: 1,
    stale: 0,
    blocked: true,
    bypassable: false,
    afterSave: { required: 2, given: 0, blocked: true, bypassable: false },
    headRevisionId: 'rev-5',
    headRevisionNumber: 5,
    headPublished: false,
    callerWroteHead: false,
    callerApprovedHead: false,
    countsStaleApprovals: false,
    approvals: [
        {
            userId: 'ada',
            revisionId: 'rev-5',
            revisionNumber: 5,
            isStale: false,
            createdAt: ago(DAY + 60_000)
        }
    ],
    request: {
        id: 'req',
        requestedBy: 'grace',
        reviewerIds: ['me', 'ada'],
        revisionId: 'rev-4',
        createdAt: ago(5 * DAY)
    },
    ...over
});

function show(item: ReviewPanelItem | null = ITEM) {
    return render(
        <IntlProvider locale="en">
            <QueryClientProvider
                client={
                    new QueryClient({
                        defaultOptions: { queries: { retry: false } }
                    })
                }
            >
                <MemoryRouter>
                    <ReviewPanel
                        item={item}
                        overdueAfterDays={3}
                        onOpenChange={() => undefined}
                    />
                </MemoryRouter>
            </QueryClientProvider>
        </IntlProvider>
    );
}

beforeEach(() => {
    canApprove = true;
    getEntryReview.mockReset().mockResolvedValue(review());
    approve.mockReset().mockResolvedValue(undefined);
});

describe('ReviewPanel', () => {
    it('says who asked whom, how far it got, and who approved last', async () => {
        show();

        expect(
            await screen.findByText(/asked you and Ada Lovelace · 5 days ago/)
        ).toBeTruthy();
        expect(
            screen.getByText('Grace Hopper', { selector: 'b' })
        ).toBeTruthy();
        expect(screen.getByText('Ada approved yesterday')).toBeTruthy();
        expect(screen.getByText('Overdue')).toBeTruthy();
        expect(screen.getByText('changes v3→v5')).toBeTruthy();
    });

    it('says what approving does, and that a new save asks again', async () => {
        show();
        expect(
            await screen.findByText(
                'Approving lets Grace publish. A new save asks again.'
            )
        ).toBeTruthy();
    });

    it('counts what is still missing after this approval', async () => {
        getEntryReview.mockResolvedValue(
            review({ required: 3, given: 0, countsStaleApprovals: true })
        );
        show();
        expect(
            await screen.findByText(
                'Approving lets Grace publish once 2 more approvals are in. Approvals stay after a new save.'
            )
        ).toBeTruthy();
    });

    it('approves the head and says so', async () => {
        show();
        fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
        await waitFor(() => expect(approve).toHaveBeenCalledTimes(1));
        expect(approve.mock.calls[0][0]).toEqual({
            typeName: 'article',
            entryId: 'e1'
        });
    });

    /** Every reason Approve is not offered is said in words. */
    it.each([
        [{ callerApprovedHead: true }, 'You approved this version'],
        [
            { callerWroteHead: true },
            'You wrote this version, so somebody else has to approve it.'
        ],
        [
            { headPublished: true },
            'This version is already live — there is nothing to approve.'
        ]
    ] as const)('offers no Approve when %o', async (over, sentence) => {
        getEntryReview.mockResolvedValue(review(over));
        show();
        expect(await screen.findByText(sentence)).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    });

    it('offers no Approve without content:approve, and says why', async () => {
        canApprove = false;
        show();
        expect(
            await screen.findByText(
                'Your role can’t approve records in this workspace.'
            )
        ).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    });

    /** A failed read is not an unreviewed record. */
    it('says the review could not be loaded', async () => {
        getEntryReview.mockRejectedValue(new Error('down'));
        show();
        expect((await screen.findByRole('alert')).textContent).toMatch(
            /could not be loaded/
        );
        expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    });

    it('links to the record for a closer look', async () => {
        show();
        const link = await screen.findByRole('link', { name: 'Open record' });
        expect(link.getAttribute('href')).toBe('/content/article/e1');
    });

    it('renders nothing while no line is under review', () => {
        show(null);
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
