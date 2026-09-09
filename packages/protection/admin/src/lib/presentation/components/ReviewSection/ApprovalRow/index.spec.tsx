import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { describe, expect, it, vi } from 'vitest';
import type { ReviewApproval } from '../../../../domain/types';
import { ApprovalRow } from './index';

vi.mock('@orthacms/workspaces-admin', () => ({
    useCurrentWorkspace: () => ({
        id: 'ws',
        members: [
            { id: 'anna', name: 'Anna Kovaleva', initials: 'AK', email: 'a@x' },
            { id: 'dmitry', name: 'Dmitry Moroz', initials: 'DM', email: 'd@x' }
        ]
    })
}));

const approval = (over: Partial<ReviewApproval> = {}): ReviewApproval => ({
    userId: 'anna',
    decision: 'approved',
    note: null,
    revisionId: 'rev-7',
    revisionNumber: 7,
    isStale: false,
    createdAt: '2026-09-09T10:00:00.000Z',
    ...over
});

const draw = (value: ReviewApproval, currentUserId?: string) =>
    render(
        <IntlProvider locale="en">
            <ul>
                <ApprovalRow approval={value} currentUserId={currentUserId} />
            </ul>
        </IntlProvider>
    );

describe('ApprovalRow', () => {
    it('names the version a current approval was given on', () => {
        draw(approval());

        expect(screen.getByText('Anna Kovaleva')).toBeTruthy();
        expect(screen.getByText(/approved version 7/)).toBeTruthy();
    });

    /**
     * The line this whole panel exists for. The strike-through is a decoration;
     * if the sentence beside it ever stops being rendered, a reader who does not
     * see the line is told a vote counts when it does not.
     */
    it('says in text that a stale approval no longer counts', () => {
        draw(approval({ userId: 'dmitry', revisionNumber: 4, isStale: true }));

        const detail = screen.getByText(/approved version 4/);
        expect(detail.textContent).toContain('the entry has changed since');
        expect(detail.textContent).toContain('no longer counts');
    });

    it('does not claim staleness for a vote that still counts', () => {
        draw(approval());

        expect(screen.queryByText(/no longer counts/)).toBeNull();
    });

    it('reads a change request as one, not as an approval', () => {
        draw(approval({ decision: 'changes_requested', revisionNumber: 7 }));

        expect(screen.getByText(/asked for changes on version 7/)).toBeTruthy();
        expect(screen.queryByText(/approved version/)).toBeNull();
    });

    it('names the signed-in person as themselves', () => {
        draw(approval(), 'anna');

        expect(screen.getByText('You')).toBeTruthy();
    });

    /** A vote is a record of who looked; a gap in the roster is not a name. */
    it('does not invent a name for somebody who has left', () => {
        draw(approval({ userId: 'gone' }));

        expect(screen.getByText('A former member')).toBeTruthy();
    });

    it('shows the note when one was left', () => {
        draw(approval({ note: 'the March figures do not match' }));

        expect(screen.getByText(/March figures/)).toBeTruthy();
    });
});
