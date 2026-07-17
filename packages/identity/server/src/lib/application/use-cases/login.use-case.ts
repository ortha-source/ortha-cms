import { randomBytes } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { OutboxWriter, UnitOfWork } from '@ortha-cms/database';
import {
    ACTIVITY_RECORDER,
    type ActivityRecorder
} from '../../activity/activity-recorder';
import { IDENTITY_ACTIVITY_KINDS } from '../../activity/activity-kinds';
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
 * session and records the sign-in in one unit of work — the audit row commits
 * iff the session does — and emits `auth.signed_in` to the transactional outbox
 * for downstream subscribers (Wave 3's audit move). Transport-agnostic: returns
 * the {@link CreatedSession} or throws; the controller maps to HTTP + cookie.
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
        private readonly sessions: SessionRepository,
        @Optional()
        @Inject(ACTIVITY_RECORDER)
        private readonly recorder?: ActivityRecorder
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
            await this.recorder?.record(
                {
                    kind: IDENTITY_ACTIVITY_KINDS.USER_SIGNED_IN,
                    subjectType: 'user',
                    subjectId: user.userId,
                    actorId: user.userId,
                    actorEmail: user.email
                },
                this.uow.current()
            );
            await this.outbox.append([
                identityEvent(IDENTITY_EVENT_KINDS.SIGNED_IN, user.userId)
            ]);
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
