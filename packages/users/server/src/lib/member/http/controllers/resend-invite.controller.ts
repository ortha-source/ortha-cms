import {
    ConflictException,
    Controller,
    NotFoundException,
    Param,
    ParseUUIDPipe,
    Post,
    UseGuards
} from '@nestjs/common';
import {
    CurrentUser,
    PermissionsGuard,
    RequirePermissions,
    type PublicUser
} from '@ortha-cms/identity-server';
import { ResendInviteUseCase } from '../../application/use-cases/resend-invite.use-case';
import {
    InvalidMemberStateError,
    MemberNotFoundError
} from '../../domain/errors';
import { MemberViewQuery } from '../../infrastructure/queries/member-view.query';
import type { InvitedMemberView } from '../../application/queries/member.view';

/**
 * `POST /api/users/:id/invites/resend` — rotates a pending member's invite
 * token, invalidating the previously sent link; requires `users:create` (the
 * same permission that issued the invite). 409s when the member is no longer
 * pending. Returns the member row plus the fresh raw `inviteToken`, so the
 * admin can hand over the new link (the old one is already dead).
 */
@UseGuards(PermissionsGuard)
@RequirePermissions('users:create')
@Controller('users')
export class ResendInviteController {
    constructor(
        private readonly resendInvite: ResendInviteUseCase,
        private readonly views: MemberViewQuery
    ) {}

    @Post(':id/invites/resend')
    async resend(
        @CurrentUser() actor: PublicUser,
        @Param('id', ParseUUIDPipe) id: string
    ): Promise<InvitedMemberView> {
        try {
            const inviteToken = await this.resendInvite.execute(actor, id);
            const view = await this.views.byId(id);
            if (!view) {
                throw new NotFoundException();
            }
            return { ...view, inviteToken };
        } catch (error) {
            if (error instanceof MemberNotFoundError) {
                throw new NotFoundException();
            }
            if (error instanceof InvalidMemberStateError) {
                throw new ConflictException(error.message);
            }
            throw error;
        }
    }
}
