import { describe, expect, it, vi } from 'vitest';
import type { WorkspaceMember } from '../../domain/types/workspace';
import { issueInvites } from '.';

const member = (
    id: string,
    email: string,
    pending: boolean
): WorkspaceMember => ({
    id,
    name: email,
    email,
    initials: 'XX',
    color: 'slate',
    pending
});

const created = {
    members: [
        member('u_me', 'me@orthacms.dev', false),
        member('u_lena', 'lena@growth.io', true),
        member('u_old', 'old@growth.io', false),
        member('u_kim', 'kim@growth.io', true)
    ]
};

const drafts = [
    {
        id: 'lena@growth.io',
        name: 'lena',
        email: 'Lena@growth.io',
        invited: true
    },
    { id: 'old@growth.io', name: 'old', email: 'old@growth.io', invited: true },
    { id: 'kim@growth.io', name: 'kim', email: 'kim@growth.io', invited: true }
];

describe('issueInvites', () => {
    it('issues each pending invitee once and reports how it left', async () => {
        const sendInvite = vi
            .fn()
            .mockResolvedValueOnce('sent')
            .mockResolvedValueOnce('link');

        const outcomes = await issueInvites(
            { sendInvite },
            created,
            drafts,
            true
        );

        expect(sendInvite.mock.calls).toEqual([['u_lena'], ['u_kim']]);
        expect(outcomes).toEqual([
            { email: 'lena@growth.io', delivery: 'sent' },
            { email: 'kim@growth.io', delivery: 'link' }
        ]);
    });

    it('leaves out an address that already had an account', async () => {
        const sendInvite = vi.fn().mockResolvedValue('sent');
        const outcomes = await issueInvites(
            { sendInvite },
            created,
            drafts,
            true
        );
        expect(outcomes.map((o) => o.email)).not.toContain('old@growth.io');
    });

    it('reports pending without asking when the user may not invite', async () => {
        const sendInvite = vi.fn();
        const outcomes = await issueInvites(
            { sendInvite },
            created,
            drafts,
            false
        );
        expect(sendInvite).not.toHaveBeenCalled();
        expect(outcomes.every((o) => o.delivery === 'pending')).toBe(true);
    });

    it('keeps going past a failed request, reporting it pending', async () => {
        const sendInvite = vi
            .fn()
            .mockRejectedValueOnce(new Error('409'))
            .mockResolvedValueOnce('sent');
        const outcomes = await issueInvites(
            { sendInvite },
            created,
            drafts,
            true
        );
        expect(outcomes).toEqual([
            { email: 'lena@growth.io', delivery: 'pending' },
            { email: 'kim@growth.io', delivery: 'sent' }
        ]);
    });
});
