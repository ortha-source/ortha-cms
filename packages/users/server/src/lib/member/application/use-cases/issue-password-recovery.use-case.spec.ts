import type { DomainEvent, OutboxWriter, UnitOfWork } from '@orthacms/database';
import {
    PasswordRecoveryRegistry,
    type PasswordRecoveryIssuer
} from '@orthacms/identity-server';
import type { MailDispatcher, TransactionalMail } from '@orthacms/mail-domain';
import { Member } from '../../domain/member';
import type { MemberRepository } from '../../domain/member.repository';
import { PasswordResetRecentlySentError } from '../../domain/errors';
import { MEMBER_EVENT_KINDS } from '../../domain/events/member-events';
import type { PasswordResetTokenService } from '../../infrastructure/persistence/password-reset-token.service';
import type { RecoveryAccountQuery } from '../../infrastructure/queries/recovery-account.query';
import { PASSWORD_RESET_COOLDOWN_SECONDS } from '../../member.constants';
import { IssuePasswordRecoveryUseCase } from './issue-password-recovery.use-case';

const MEMBER_ID = '11111111-1111-4111-8111-111111111111';
const EXPIRES_AT = new Date('2026-09-20T08:30:00.000Z');

/**
 * `IssuePasswordRecoveryUseCase` — the users side of self-service recovery
 * (ADR-0018 phase 2, `docs/design/mail.md` mail:I-09 / mail:I-10). It runs
 * after identity's public route has already answered, so every refusal here is
 * a silent return: what is pinned is which of them destroy nothing and send
 * nothing.
 */
describe('IssuePasswordRecoveryUseCase', () => {
    function member(status = 'active'): Member {
        return Member.rehydrate({
            id: MEMBER_ID,
            email: 'ada@example.com',
            name: 'Ada',
            roleKey: 'contributor',
            status
        });
    }

    function harness(options: {
        accountId?: string | null;
        member?: Member | null;
        mail?: boolean;
        cooldown?: boolean;
    }) {
        const trace: string[] = [];
        const appended: DomainEvent[] = [];
        const queued: TransactionalMail[] = [];
        const rotations: { userId: string; options: unknown }[] = [];

        const accounts = {
            idForEmail: async (email: string) => {
                trace.push(`lookup:${email}`);
                return options.accountId === undefined
                    ? MEMBER_ID
                    : options.accountId;
            }
        } as unknown as RecoveryAccountQuery;

        const members = {
            findById: async () => {
                trace.push('findById');
                return options.member === undefined ? member() : options.member;
            }
        } as unknown as MemberRepository;

        const resetTokens = {
            rotate: async (
                userId: string,
                _executor: unknown,
                rotateOptions: unknown
            ) => {
                trace.push('resetTokens:rotate');
                rotations.push({ userId, options: rotateOptions });
                if (options.cooldown) {
                    throw new PasswordResetRecentlySentError(userId, 42);
                }
                return { raw: 'raw-reset-token', expiresAt: EXPIRES_AT };
            }
        } as unknown as PasswordResetTokenService;

        const uow = {
            run: async <T>(fn: () => Promise<T>): Promise<T> => {
                trace.push('uow:enter');
                try {
                    return await fn();
                } finally {
                    trace.push('uow:exit');
                }
            },
            current: () => ({}) as never
        } as unknown as UnitOfWork;

        const outbox = {
            append: async (events: DomainEvent[]) => {
                trace.push('outbox:append');
                appended.push(...events);
            }
        } as unknown as OutboxWriter;

        const mail: MailDispatcher | undefined =
            options.mail === false
                ? undefined
                : {
                      revealsLinks: false,
                      enqueue: async (item) => {
                          trace.push('mail:enqueue');
                          queued.push(item);
                      },
                      revealableLink: async () => null
                  };

        const registry = new PasswordRecoveryRegistry();
        const useCase = new IssuePasswordRecoveryUseCase(
            uow,
            outbox,
            resetTokens,
            accounts,
            registry,
            members,
            mail
        );
        return { useCase, registry, trace, appended, queued, rotations };
    }

    it('registers itself with identity’s public route on init', () => {
        const test = harness({});
        test.useCase.onModuleInit();
        const registered: PasswordRecoveryIssuer | null =
            test.registry.current();
        expect(registered).toBe(test.useCase);
    });

    it('is unavailable — and sends nothing — without a mail provider', async () => {
        const test = harness({ mail: false });

        expect(test.useCase.available).toBe(false);
        await test.useCase.issue('ada@example.com');
        expect(test.trace).toEqual([]);
    });

    it('rotates, queues the recovery message and records the issue in one unit of work', async () => {
        const test = harness({});

        await test.useCase.issue('ada@example.com');

        expect(test.trace).toEqual([
            'lookup:ada@example.com',
            'uow:enter',
            'findById',
            'resetTokens:rotate',
            'mail:enqueue',
            'outbox:append',
            'uow:exit'
        ]);
        expect(test.rotations).toEqual([
            {
                userId: MEMBER_ID,
                options: { minIntervalSeconds: PASSWORD_RESET_COOLDOWN_SECONDS }
            }
        ]);
        expect(test.queued).toEqual([
            {
                kind: 'password_recovery',
                to: 'ada@example.com',
                userId: MEMBER_ID,
                recipientName: 'Ada',
                token: 'raw-reset-token',
                expiresAt: EXPIRES_AT
            }
        ]);
        // The member is their own actor: nobody else asked.
        expect(test.appended.map((event) => event.kind)).toEqual([
            MEMBER_EVENT_KINDS.PASSWORD_RESET_ISSUED
        ]);
        expect(test.appended[0].payload).toMatchObject({
            email: 'ada@example.com',
            actor: { id: MEMBER_ID, email: 'ada@example.com' }
        });
    });

    it('does nothing for an address no account uses [mail:I-09]', async () => {
        const test = harness({ accountId: null });

        await expect(
            test.useCase.issue('nobody@example.com')
        ).resolves.toBeUndefined();
        expect(test.trace).toEqual(['lookup:nobody@example.com']);
        expect(test.queued).toEqual([]);
    });

    it.each(['disabled', 'pending'])(
        'sends a %s member nothing and destroys nothing [mail:I-10]',
        async (status) => {
            const test = harness({ member: member(status) });

            await expect(
                test.useCase.issue('ada@example.com')
            ).resolves.toBeUndefined();
            expect(test.trace).not.toContain('resetTokens:rotate');
            expect(test.queued).toEqual([]);
            expect(test.appended).toEqual([]);
        }
    );

    it('stays quiet inside the cooldown rather than killing a link just sent', async () => {
        const test = harness({ cooldown: true });

        await expect(
            test.useCase.issue('ada@example.com')
        ).resolves.toBeUndefined();
        expect(test.queued).toEqual([]);
        expect(test.appended).toEqual([]);
    });
});
