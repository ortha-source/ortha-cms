import type { UnitOfWork } from '@orthacms/database';
import type { PublicUser } from '@orthacms/identity-server';
import type { MemberRepository } from '../../domain/member.repository';
import { EmailTakenError, EmailsTakenError } from '../../domain/errors';
import type { InviteMembersDto } from '../dto/invite-members.dto';
import type {
    InviteMemberUseCase,
    InvitedMember
} from './invite-member.use-case';
import { InviteMembersUseCase } from './invite-members.use-case';

const ACTOR: PublicUser = {
    id: '99999999-9999-4999-8999-999999999999',
    email: 'admin@example.com',
    name: 'Admin',
    roleId: '33333333-3333-4333-8333-333333333333',
    status: 'active'
};

const EXPIRES_AT = new Date('2026-11-01T00:00:00.000Z');
const WORKSPACE = '44444444-4444-4444-8444-444444444444';

/**
 * `InviteMembersUseCase` — the batch behind the admin's invite sheet.
 *
 * Two properties are the point of it, and both fail quietly when broken:
 *
 * - **All-or-nothing.** Every address is checked before anything is written,
 *   and every per-address invite runs inside the one unit of work, so a
 *   collision (or a race the unique index catches) leaves no half-invited
 *   team behind.
 * - **One answer naming every collision**, so the sheet can flag each chip at
 *   once instead of making the admin discover them one retry at a time.
 */
describe('InviteMembersUseCase', () => {
    function harness(options: { taken?: string[]; failOn?: string }) {
        const trace: string[] = [];
        const invitedWith: { email: string; role: string }[] = [];
        let depth = 0;

        const members = {
            takenEmails: async (emails: readonly string[]) => {
                trace.push(`takenEmails:${emails.join(',')}`);
                return options.taken ?? [];
            }
        } as unknown as MemberRepository;

        const uow = {
            run: async <T>(fn: () => Promise<T>): Promise<T> => {
                trace.push('uow:enter');
                depth += 1;
                try {
                    return await fn();
                } finally {
                    depth -= 1;
                    trace.push('uow:exit');
                }
            }
        } as unknown as UnitOfWork;

        const inviteMember = {
            execute: async (
                _actor: PublicUser,
                dto: { email: string; role: string; workspaceIds?: string[] }
            ): Promise<InvitedMember> => {
                // Every per-address invite must happen inside the batch's
                // transaction, or a later failure cannot roll it back.
                trace.push(`invite:${dto.email}:depth=${depth}`);
                if (dto.email === options.failOn) {
                    throw new EmailTakenError(dto.email);
                }
                invitedWith.push({ email: dto.email, role: dto.role });
                return {
                    id: `id-${dto.email}`,
                    inviteToken: `tok-${dto.email}`,
                    expiresAt: EXPIRES_AT
                };
            }
        } as unknown as InviteMemberUseCase;

        return {
            useCase: new InviteMembersUseCase(uow, inviteMember, members),
            trace,
            invitedWith
        };
    }

    function dto(emails: string[]): InviteMembersDto {
        return {
            emails,
            role: 'contributor',
            workspaceIds: [WORKSPACE]
        } as InviteMembersDto;
    }

    it('invites every address, in order, inside one unit of work', async () => {
        const test = harness({});

        const result = await test.useCase.execute(
            ACTOR,
            dto(['lena@growth.io', 'sam@growth.io'])
        );

        expect(result.map((item) => item.id)).toEqual([
            'id-lena@growth.io',
            'id-sam@growth.io'
        ]);
        expect(test.trace).toEqual([
            'takenEmails:lena@growth.io,sam@growth.io',
            'uow:enter',
            'invite:lena@growth.io:depth=1',
            'invite:sam@growth.io:depth=1',
            'uow:exit'
        ]);
        expect(
            test.invitedWith.every((item) => item.role === 'contributor')
        ).toBe(true);
    });

    it('compares addresses case-insensitively', async () => {
        const test = harness({});

        await test.useCase.execute(ACTOR, dto(['  Lena@Growth.IO ']));

        expect(test.trace[0]).toBe('takenEmails:lena@growth.io');
        expect(test.invitedWith[0].email).toBe('lena@growth.io');
    });

    it('refuses the whole batch up front, naming every taken address', async () => {
        const test = harness({
            taken: ['ada@orthacms.dev', 'grace@orthacms.dev']
        });

        const attempt = test.useCase.execute(
            ACTOR,
            dto(['lena@growth.io', 'ada@orthacms.dev', 'grace@orthacms.dev'])
        );

        await expect(attempt).rejects.toBeInstanceOf(EmailsTakenError);
        await expect(attempt).rejects.toMatchObject({
            emails: ['ada@orthacms.dev', 'grace@orthacms.dev'],
            code: 'EMAIL_TAKEN'
        });
        // Nothing was written: no transaction, no invite for the free address.
        expect(test.trace).not.toContain('uow:enter');
        expect(test.invitedWith).toEqual([]);
    });

    it('lets a mid-batch collision escape the unit of work so it rolls back', async () => {
        const test = harness({ failOn: 'sam@growth.io' });

        await expect(
            test.useCase.execute(
                ACTOR,
                dto(['lena@growth.io', 'sam@growth.io', 'kai@growth.io'])
            )
        ).rejects.toBeInstanceOf(EmailTakenError);

        // The first invite ran inside the transaction that the error leaves,
        // which is what discards it; the third was never attempted.
        expect(test.trace).toEqual([
            'takenEmails:lena@growth.io,sam@growth.io,kai@growth.io',
            'uow:enter',
            'invite:lena@growth.io:depth=1',
            'invite:sam@growth.io:depth=1',
            'uow:exit'
        ]);
    });
});
