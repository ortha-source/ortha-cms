import { Inject, Injectable } from '@nestjs/common';
import {
    INVITE_REPOSITORY,
    type InviteRepository
} from '../../domain/invite.repository';
import { InvalidInviteTokenError } from '../../domain/errors';
import { HashingService } from '../../auth/services/hashing.service';

/**
 * What the accept-invite screen renders back to the invitee. The admin already
 * chose these when they sent the invite, so the screen **shows** them rather
 * than collecting them — all the invitee supplies is a password.
 */
export interface InviteDescription {
    /** The email the invite was addressed to. */
    email: string;
    /** The display name the inviting admin set, or `null` when they set none. */
    name: string | null;
}

/**
 * Resolves an invite link's raw token to the invite it stands for, so the
 * accept screen can greet the right person before any password is typed. A pure
 * read — it does **not** consume the token, so opening the link twice (or
 * refreshing the page) is harmless.
 *
 * Every failure mode — unknown, expired, already accepted, revoked — raises the
 * same {@link InvalidInviteTokenError}, which the controller renders as one
 * generic 404. Nothing here distinguishes them, so the endpoint cannot be used
 * to probe for live invites.
 */
@Injectable()
export class DescribeInviteUseCase {
    constructor(
        private readonly hashing: HashingService,
        @Inject(INVITE_REPOSITORY)
        private readonly invites: InviteRepository
    ) {}

    /** Describes the invite `rawToken` stands for, or throws. */
    async execute(rawToken: string): Promise<InviteDescription> {
        const invite = await this.invites.findPendingByTokenHash(
            this.hashing.hashToken(rawToken)
        );
        if (!invite) {
            throw new InvalidInviteTokenError();
        }
        return { email: invite.email, name: invite.name };
    }
}
