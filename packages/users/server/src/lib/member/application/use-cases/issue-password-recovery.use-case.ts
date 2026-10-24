import {
    Inject,
    Injectable,
    Optional,
    type OnModuleInit
} from '@nestjs/common';
import { attachActor, OutboxWriter, UnitOfWork } from '@orthacms/database';
import {
    PasswordRecoveryRegistry,
    type PasswordRecoveryIssuer
} from '@orthacms/identity-server';
import { PASSWORD_RESET_COOLDOWN_SECONDS } from '../../member.constants';
import { MemberId } from '../../domain/value-objects/member-id';
import {
    InvalidMemberStateError,
    PasswordResetRecentlySentError
} from '../../domain/errors';
import {
    MEMBER_EVENT_KINDS,
    memberEvent
} from '../../domain/events/member-events';
import {
    MEMBER_REPOSITORY,
    type MemberRepository
} from '../../domain/member.repository';
import { PasswordResetTokenService } from '../../infrastructure/persistence/password-reset-token.service';
import { RecoveryAccountQuery } from '../../infrastructure/queries/recovery-account.query';
import {
    MAIL_DISPATCHER,
    MAIL_KINDS,
    type MailDispatcher
} from '../ports/mail-notifier.port';

/**
 * The self-service half of the reset flow (ADR-0018 phase 2): sends a reset
 * link to the address a signed-out person typed into the public "forgot your
 * password?" form — when, and only when, an active member uses it.
 *
 * **It has no route.** The public route is identity's
 * (`POST /api/auth/password-recovery`), which owns the signed-out surface, its
 * rate limits and the rule that its answer never varies with the address; this
 * package keeps no public routes (users:I-12) and exports nothing (users:I-18).
 * So it registers itself with identity's {@link PasswordRecoveryRegistry} on
 * init, and identity calls {@link issue} off the request.
 *
 * Every refusal is a silent return — an unknown address, a member who is not
 * `active` (the same `ensureCanResetPassword` guard the admin path uses: a
 * disabled account must not get a credential-setting link, and a pending one
 * finishes through its invite), or a link sent under
 * {@link PASSWORD_RESET_COOLDOWN_SECONDS} ago. Without a mail provider it is
 * {@link available} `false` and identity answers `404`.
 *
 * A successful issue rotates the token exactly like
 * {@link IssuePasswordResetUseCase} — any outstanding link dies — queues the
 * `password_recovery` message in the same transaction, and records
 * `member.password_reset_issued` with the member as their own actor, so the
 * audit trail shows a link went out and that nobody else asked for it.
 */
@Injectable()
export class IssuePasswordRecoveryUseCase
    implements PasswordRecoveryIssuer, OnModuleInit
{
    constructor(
        private readonly uow: UnitOfWork,
        private readonly outbox: OutboxWriter,
        private readonly resetTokens: PasswordResetTokenService,
        private readonly accounts: RecoveryAccountQuery,
        private readonly registry: PasswordRecoveryRegistry,
        @Inject(MEMBER_REPOSITORY)
        private readonly members: MemberRepository,
        // Optional: nothing is bound when no mail plugin is registered, and
        // then there is no self-service recovery at all.
        @Optional()
        @Inject(MAIL_DISPATCHER)
        private readonly mail?: MailDispatcher
    ) {}

    /** Offers itself to identity's public route. */
    onModuleInit(): void {
        this.registry.register(this);
    }

    /** Whether a message can be sent at all — i.e. a mail provider is bound. */
    get available(): boolean {
        return !!this.mail;
    }

    /** {@inheritDoc PasswordRecoveryIssuer.issue} */
    async issue(email: string): Promise<void> {
        const mail = this.mail;
        if (!mail) return;

        const userId = await this.accounts.idForEmail(email);
        if (!userId) return;

        await this.uow.run(async () => {
            const member = await this.members.findById(MemberId.create(userId));
            if (!member) return;
            try {
                member.ensureCanResetPassword();
            } catch (error) {
                if (error instanceof InvalidMemberStateError) return;
                throw error;
            }

            let reset;
            try {
                reset = await this.resetTokens.rotate(
                    member.id.value,
                    this.uow.current(),
                    { minIntervalSeconds: PASSWORD_RESET_COOLDOWN_SECONDS }
                );
            } catch (error) {
                // A link went out moments ago; another would kill it while the
                // first may still be on its way.
                if (error instanceof PasswordResetRecentlySentError) return;
                throw error;
            }

            // In-band with the rotation: the plaintext exists only here.
            await mail.enqueue({
                kind: MAIL_KINDS.PASSWORD_RECOVERY,
                to: member.email,
                userId: member.id.value,
                recipientName: member.name,
                token: reset.raw,
                expiresAt: reset.expiresAt
            });

            await this.outbox.append(
                attachActor(
                    [
                        memberEvent(
                            MEMBER_EVENT_KINDS.PASSWORD_RESET_ISSUED,
                            member.id.value,
                            { email: member.email }
                        )
                    ],
                    { id: member.id.value, email: member.email }
                )
            );
        });
    }
}
