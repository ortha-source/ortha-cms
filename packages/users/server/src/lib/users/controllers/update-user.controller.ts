import {
    Body,
    ConflictException,
    Controller,
    NotFoundException,
    Param,
    ParseUUIDPipe,
    Patch,
    UseGuards
} from '@nestjs/common';
import {
    CurrentUser,
    PermissionsGuard,
    RequirePermissions,
    type PublicUser
} from '@ortha-cms/identity-server';
import { UpdateUserDto } from '../dto/update-user.dto';
import {
    LastAdminProtectedError,
    MemberNotFoundError,
    SelfActionError
} from '../errors';
import { UsersService } from '../services/users.service';
import type { MemberView } from '../types/member-view';

/**
 * `PATCH /api/users/:id` — edits a member's display name and/or role;
 * requires `users:update`. Changing your own role, and demoting the last
 * remaining active admin, are each rejected with a 409 (the UI disables the
 * control with the same rationale).
 */
@UseGuards(PermissionsGuard)
@RequirePermissions('users:update')
@Controller('users')
export class UpdateUserController {
    constructor(private readonly users: UsersService) {}

    @Patch(':id')
    async update(
        @CurrentUser() actor: PublicUser,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: UpdateUserDto
    ): Promise<MemberView> {
        try {
            return await this.users.update(actor, id, body);
        } catch (error) {
            if (error instanceof MemberNotFoundError) {
                throw new NotFoundException();
            }
            if (error instanceof SelfActionError) {
                throw new ConflictException(
                    'You cannot change your own role'
                );
            }
            if (error instanceof LastAdminProtectedError) {
                throw new ConflictException(
                    'The last remaining admin cannot be demoted'
                );
            }
            throw error;
        }
    }
}
