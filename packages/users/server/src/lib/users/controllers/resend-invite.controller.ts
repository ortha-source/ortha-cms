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
    PermissionsGuard,
    RequirePermissions
} from '@ortha-cms/identity-server';
import { InvalidMemberStateError, MemberNotFoundError } from '../errors';
import { UsersService } from '../services/users.service';
import type { MemberView } from '../types/member-view';

/**
 * `POST /api/users/:id/invites/resend` — rotates a pending member's invite
 * token, invalidating the previously sent link; requires `users:create` (the
 * same permission that issued the invite). 409s when the member is no longer
 * pending.
 */
@UseGuards(PermissionsGuard)
@RequirePermissions('users:create')
@Controller('users')
export class ResendInviteController {
    constructor(private readonly users: UsersService) {}

    @Post(':id/invites/resend')
    async resend(@Param('id', ParseUUIDPipe) id: string): Promise<MemberView> {
        try {
            return await this.users.resendInvite(id);
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
