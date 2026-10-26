import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@orthacms/utils-admin';
import { httpMemberGateway } from '../../infrastructure/httpMemberGateway';
import type { InvitedMember } from '../../domain/types/member';
import { useInviteMembersFlow } from './index';

vi.mock('../../infrastructure/httpMemberGateway', () => ({
    httpMemberGateway: { inviteMany: vi.fn() }
}));

const inviteMany = vi.mocked(httpMemberGateway.inviteMany);

let client: QueryClient;

/** One client per test — a fresh one per render would drop the mutation. */
function wrapper({ children }: { children: ReactNode }) {
    return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
}

/** An invited member as the gateway maps one. */
function invited(email: string, token: string | null): InvitedMember {
    return {
        id: `id-${email}`,
        email,
        name: email,
        initials: 'X',
        color: 'violet',
        role: 'contributor',
        roleName: 'Contributor',
        status: 'pending',
        joinedAt: new Date(),
        isLastAdmin: false,
        workspaces: [],
        lastActiveAt: null,
        inviteToken: token,
        inviteExpiresAt: new Date('2026-11-01T00:00:00.000Z')
    };
}

const DRAFT = {
    emails: ['lena@growth.io', 'sam@growth.io'],
    role: 'contributor' as const,
    workspaceIds: ['ws_1']
};

describe('useInviteMembersFlow', () => {
    beforeEach(() => {
        inviteMany.mockReset();
        client = new QueryClient({
            defaultOptions: { mutations: { retry: false } }
        });
    });

    it('turns each invite into a link to hand over', async () => {
        inviteMany.mockResolvedValue([
            invited('lena@growth.io', 'tok_lena'),
            invited('sam@growth.io', null)
        ]);
        const { result } = renderHook(() => useInviteMembersFlow(), {
            wrapper
        });

        let sent: Awaited<ReturnType<typeof result.current.submit>> = null;
        await act(async () => {
            sent = await result.current.submit(DRAFT);
        });

        expect(inviteMany).toHaveBeenCalledWith(DRAFT);
        expect(sent).toEqual([
            expect.objectContaining({
                email: 'lena@growth.io',
                link: expect.stringMatching(
                    /\/identity\/accept-invite\?token=tok_lena$/
                )
            }),
            // Mailed: there is no link, and nothing pretends there is.
            expect.objectContaining({ email: 'sam@growth.io', link: null })
        ]);
        expect(result.current.error).toBeNull();
    });

    it('collects the addresses a 409 names as taken', async () => {
        inviteMany.mockRejectedValue(
            new ApiError(409, 'Conflict', {
                code: 'EMAIL_TAKEN',
                emails: ['Sam@Growth.io']
            })
        );
        const { result } = renderHook(() => useInviteMembersFlow(), {
            wrapper
        });

        await act(async () => {
            expect(await result.current.submit(DRAFT)).toBeNull();
        });

        expect(result.current.error).toBe('taken');
        expect(result.current.takenEmails).toEqual(['sam@growth.io']);

        act(() => result.current.reset());
        expect(result.current.takenEmails).toEqual([]);
    });

    it('reports any other failure without throwing', async () => {
        inviteMany.mockRejectedValue(new ApiError(500));
        const { result } = renderHook(() => useInviteMembersFlow(), {
            wrapper
        });
        await act(async () => {
            await result.current.submit(DRAFT);
        });
        expect(result.current.error).toBe('failed');
    });

    it('never sends a malformed address', async () => {
        const { result } = renderHook(() => useInviteMembersFlow(), {
            wrapper
        });
        await act(async () => {
            await result.current.submit({ ...DRAFT, emails: ['nope'] });
        });
        expect(inviteMany).not.toHaveBeenCalled();
        expect(result.current.error).toBe('failed');
    });
});
