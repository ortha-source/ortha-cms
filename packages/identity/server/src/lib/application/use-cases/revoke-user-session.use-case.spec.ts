import type { DomainEvent, OutboxWriter, UnitOfWork } from '@orthacms/database';
import type {
    SessionRepository,
    UserSessionView
} from '../../domain/session.repository';
import type { PublicUser } from '../../auth/services/auth.service';
import { IDENTITY_EVENT_KINDS } from '../../domain/events/identity-events';
import { RevokeUserSessionUseCase } from './revoke-user-session.use-case';

const USER_ID = '11111111-1111-4111-8111-111111111111';

const ACTOR = {
    id: '99999999-9999-4999-8999-999999999999',
    email: 'admin@example.com'
} as PublicUser;

/** A live session row as `listForUser` returns it. */
function session(id: string): UserSessionView {
    const now = new Date('2026-10-20T00:00:00.000Z');
    return {
        id,
        userAgent: null,
        ipAddress: null,
        createdAt: now,
        lastUsedAt: now,
        expiresAt: now
    };
}

/**
 * `RevokeUserSessionUseCase.executeAll` — "Sign out everywhere" on the member
 * page. The audit trail is the part that regresses quietly: one row per
 * session that actually ended, none for a session that was already dead, and
 * the caller's own session left alone so an admin on their own page is not
 * signed out by their own click.
 */
describe('RevokeUserSessionUseCase.executeAll', () => {
    function harness(live: string[], alreadyDead: string[] = []) {
        const revoked: string[] = [];
        const appended: DomainEvent[] = [];
        let inUnitOfWork = false;

        const sessions = {
            listForUser: async () => live.map(session),
            revokeById: async (_userId: string, sessionId: string) => {
                expect(inUnitOfWork).toBe(true);
                if (alreadyDead.includes(sessionId)) {
                    return false;
                }
                revoked.push(sessionId);
                return true;
            }
        } as unknown as SessionRepository;

        const uow = {
            run: async <T>(fn: () => Promise<T>): Promise<T> => {
                inUnitOfWork = true;
                try {
                    return await fn();
                } finally {
                    inUnitOfWork = false;
                }
            }
        } as unknown as UnitOfWork;

        const outbox = {
            append: async (events: DomainEvent[]) => {
                expect(inUnitOfWork).toBe(true);
                appended.push(...events);
            }
        } as unknown as OutboxWriter;

        return {
            useCase: new RevokeUserSessionUseCase(uow, outbox, sessions),
            revoked,
            appended
        };
    }

    it('ends every live session and records one row per session', async () => {
        const test = harness(['s1', 's2']);

        const count = await test.useCase.executeAll(USER_ID, { actor: ACTOR });

        expect(count).toBe(2);
        expect(test.revoked).toEqual(['s1', 's2']);
        expect(test.appended.map((event) => event.kind)).toEqual([
            IDENTITY_EVENT_KINDS.SESSION_REVOKED,
            IDENTITY_EVENT_KINDS.SESSION_REVOKED
        ]);
        expect(test.appended[0].payload).toMatchObject({
            sessionId: 's1',
            actor: { id: ACTOR.id, email: ACTOR.email }
        });
    });

    it('keeps the caller’s own session alive', async () => {
        const test = harness(['mine', 'theirs']);

        const count = await test.useCase.executeAll(USER_ID, {
            exceptSessionId: 'mine',
            actor: ACTOR
        });

        expect(count).toBe(1);
        expect(test.revoked).toEqual(['theirs']);
    });

    it('writes nothing for a session that was already gone', async () => {
        const test = harness(['s1', 'raced'], ['raced']);

        const count = await test.useCase.executeAll(USER_ID);

        expect(count).toBe(1);
        expect(test.appended).toHaveLength(1);
    });

    it('answers zero, and appends nothing, when nobody is signed in', async () => {
        const test = harness([]);

        await expect(test.useCase.executeAll(USER_ID)).resolves.toBe(0);
        expect(test.appended).toEqual([]);
    });
});
