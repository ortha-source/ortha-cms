import { Inject, Injectable, Optional } from '@nestjs/common';
import { OutboxWriter, UnitOfWork } from '@ortha-cms/database';
import {
    ACTIVITY_RECORDER,
    type ActivityRecorder
} from '../../activity/activity-recorder';
import { IDENTITY_ACTIVITY_KINDS } from '../../activity/activity-kinds';
import { IDENTITY_EVENT_KINDS, identityEvent } from '../../domain/events/identity-events';
import {
    SESSION_REPOSITORY,
    type SessionRepository
} from '../../domain/session.repository';
import { UserLookupQuery } from '../../infrastructure/queries/user-lookup.query';

/**
 * Ends the session identified by an opaque token (logout). Idempotent — an
 * unknown or already-revoked token simply does nothing, and the user's other
 * sessions are left untouched. Records the sign-out in-band and emits
 * `auth.signed_out` to the outbox, but only when a live session was actually
 * revoked, so the trail stays free of phantom logout events. Transport-agnostic:
 * the controller owns reading the cookie and clearing it.
 */
@Injectable()
export class LogoutUseCase {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly outbox: OutboxWriter,
        private readonly users: UserLookupQuery,
        @Inject(SESSION_REPOSITORY)
        private readonly sessions: SessionRepository,
        @Optional()
        @Inject(ACTIVITY_RECORDER)
        private readonly recorder?: ActivityRecorder
    ) {}

    /** Revokes the presented session, if any, recording the sign-out. */
    async execute(token: string): Promise<void> {
        await this.uow.run(async () => {
            const revoked = await this.sessions.revokeByToken(token);
            // Nothing revoked (unknown/already-revoked token) → no audit/event.
            if (!revoked) {
                return;
            }

            const actorEmail = await this.users.emailById(revoked.userId);
            await this.recorder?.record(
                {
                    kind: IDENTITY_ACTIVITY_KINDS.USER_SIGNED_OUT,
                    subjectType: 'user',
                    subjectId: revoked.userId,
                    actorId: revoked.userId,
                    actorEmail
                },
                this.uow.current()
            );
            await this.outbox.append([
                identityEvent(IDENTITY_EVENT_KINDS.SIGNED_OUT, revoked.userId)
            ]);
        });
    }
}
