import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { attachActor, OutboxWriter, UnitOfWork } from '@ortha-cms/database';
import { IDENTITY_EVENT_KINDS, identityEvent } from '../../domain/events/identity-events';
import type { SessionContext } from '../../domain/session';
import {
    SESSION_REPOSITORY,
    type CreatedSession,
    type SessionRepository
} from '../../domain/session.repository';
import { InvalidCredentialsError } from '../../auth/errors';
import { HashingService } from '../../auth/services/hashing.service';
import { UserLookupQuery } from '../../infrastructure/queries/user-lookup.query';

/**
 * Email/password sign-in. Verifies credentials, then opens a server-side
 * session in one unit of work and emits `auth.signed_in` (carrying the actor)
 * to the transactional outbox — the event commits iff the session does — where
 * the activity subscriber turns it into the `user.signed_in` audit row.
 * Transport-agnostic: returns the {@link CreatedSession} or throws; the
 * controller maps to HTTP + cookie.
 */
@Injectable()
export class LoginUseCase {
    /**
     * A throwaway bcrypt hash, computed once, used to equalize verify timing
     * when the user (or their hash) is absent — so a missing account can't be
     * told from a wrong password by response time.
     */
    private dummyHash: Promise<string> | null = null;

    constructor(
        private readonly uow: UnitOfWork,
        private readonly outbox: OutboxWriter,
        private readonly users: UserLookupQuery,
        private readonly hashing: HashingService,
        @Inject(SESSION_REPOSITORY)
        private readonly sessions: SessionRepository
    ) {}

    /**
     * Verifies `email`/`password` and opens a session on success. Every failure
     * — unknown email, invite-pending (null hash), non-active status, or wrong
     * password — throws the same {@link InvalidCredentialsError} and performs one
     * bcrypt comparison, so neither the response body nor its timing leaks which
     * accounts exist (no user enumeration).
     */
    async execute(
        email: string,
        password: string,
        context: SessionContext = {}
    ): Promise<CreatedSession> {
        const user = await this.users.credentialsByEmail(email);

        // Always run a comparison, even with no user/hash, to hold timing flat.
        const hashed = user?.passwordHash ?? (await this.getDummyHash());
        const passwordOk = await this.hashing.verifyPassword(hashed, password);

        if (
            !user ||
            !user.passwordHash ||
            user.status !== 'active' ||
            !passwordOk
        ) {
            throw new InvalidCredentialsError();
        }

        return this.uow.run(async () => {
            const session = await this.sessions.issue(user.userId, context);
            // The signer is their own actor; the subscriber reads it back off
            // the event to write the audit row.
            await this.outbox.append(
                attachActor(
                    [identityEvent(IDENTITY_EVENT_KINDS.SIGNED_IN, user.userId)],
                    { id: user.userId, email: user.email }
                )
            );
            return session;
        });
    }

    private getDummyHash(): Promise<string> {
        if (!this.dummyHash) {
            this.dummyHash = this.hashing.hashPassword(
                randomBytes(32).toString('hex')
            );
        }
        return this.dummyHash;
    }
}
