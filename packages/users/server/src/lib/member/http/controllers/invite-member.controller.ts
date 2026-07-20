import {
    Body,
    ConflictException,
    Controller,
    NotFoundException,
    Post,
    UseGuards
} from '@nestjs/common';
import {
    CurrentUser,
    PermissionsGuard,
    RequirePermissions,
    type PublicUser
} from '@ortha-cms/identity-server';
import { InviteMemberDto } from '../../application/dto/invite-member.dto';
import { InviteMemberUseCase } from '../../application/use-cases/invite-member.use-case';
import { EmailTakenError } from '../../domain/errors';
import { MemberViewQuery } from '../../infrastructure/queries/member-view.query';
import type { MemberView } from '../../application/queries/member.view';

/**
 * `POST /api/users/invites` — invites a person by email. Creates the pending
 * member and issues their invite token; requires `users:create`. Returns the
 * new member row so the admin list can show it immediately with its
 * "Invited" status.
 */
@UseGuards(PermissionsGuard)
@RequirePermissions('users:create')
@Controller('users')
export class InviteMemberController {
    constructor(
        private readonly inviteMember: InviteMemberUseCase,
        private readonly views: MemberViewQuery
    ) {}

    @Post('invites')
    async invite(
        @CurrentUser() actor: PublicUser,
        @Body() body: InviteMemberDto
    ): Promise<MemberView> {
        try {
            const id = await this.inviteMember.execute(actor, body);
            const view = await this.views.byId(id);
            if (!view) {
                throw new NotFoundException();
            }
            return view;
        } catch (error) {
            if (error instanceof EmailTakenError) {
                throw new ConflictException(
                    'A user with this email already exists'
                );
            }
            throw error;
        }
    }
}
