import {
    ConflictException,
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Param,
    ParseUUIDPipe,
    UseGuards
} from '@nestjs/common';
import {
    PermissionsGuard,
    RequirePermission
} from '@ortha-cms/identity-server';
import { InvalidMemberStateError, MemberNotFoundError } from '../errors';
import { UsersService } from '../services/users.service';

/**
 * `DELETE /api/users/:id/invites` — revokes a pending invite by deleting the
 * placeholder user row (cascades drop the token and any memberships);
 * requires `users:delete`. Real accounts are never deleted this way — a
 * non-pending target 409s.
 */
@UseGuards(PermissionsGuard)
@RequirePermission('users:delete')
@Controller('users')
export class RevokeInviteController {
    constructor(private readonly users: UsersService) {}

    @Delete(':id/invites')
    @HttpCode(HttpStatus.NO_CONTENT)
    async revoke(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
        try {
            await this.users.revokeInvite(id);
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
