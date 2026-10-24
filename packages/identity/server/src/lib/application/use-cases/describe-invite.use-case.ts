import { Inject, Injectable, Optional } from '@nestjs/common';
import {
    INVITE_REPOSITORY,
    type InviteRepository
} from '../../domain/invite.repository';
import { InvalidInviteTokenError } from '../../domain/errors';
import { HashingService } from '../../auth/services/hashing.service';
import {
    INVITE_WORKSPACE_DIRECTORY,
    type InviteWorkspaceDirectory
} from '../ports/invite-workspace-directory.port';

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
    /** The display name of the role the invite grants, or `null` when unknown. */
    role: string | null;
    /**
     * The workspaces the invitee will be a member of, by display name. Empty
     * when they were invited into none, or when no workspaces plugin is
     * registered to say.
     */
    workspaces: string[];
}

/**
 * Resolves an invite link's raw token to the invite it stands for, so the
 * accept screen can greet the right person before any password is typed. A pure
 * read — it does **not** consume the token, so opening the link twice (or
 * refreshing the page) is harmless.
 *
 * It says **what** the invite is for — the role and the workspaces — and never
 * **who** sent it. The page is public: a link that leaked, or one pasted into
 * the wrong chat, must not hand a stranger the name of an administrator. The
 * role and the workspaces are what the token already grants to whoever redeems
 * it, so naming them tells the holder nothing the token does not.
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
        private readonly invites: InviteRepository,
        // Optional: nothing is bound when no workspaces plugin is registered.
        @Optional()
        @Inject(INVITE_WORKSPACE_DIRECTORY)
        private readonly workspaces?: InviteWorkspaceDirectory
    ) {}

    /** Describes the invite `rawToken` stands for, or throws. */
    async execute(rawToken: string): Promise<InviteDescription> {
        const invite = await this.invites.findPendingByTokenHash(
            this.hashing.hashToken(rawToken)
        );
        if (!invite) {
            throw new InvalidInviteTokenError();
        }
        const workspaces = this.workspaces
            ? await this.workspaces.namesFor(invite.userId)
            : [];
        return {
            email: invite.email,
            name: invite.name,
            role: invite.role,
            workspaces
        };
    }
}
