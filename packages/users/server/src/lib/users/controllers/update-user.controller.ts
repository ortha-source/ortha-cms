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
    PermissionsGuard,
    RequirePermissions
} from '@ortha-cms/identity-server';
import { UpdateUserDto } from '../dto/update-user.dto';
import { LastAdminProtectedError, MemberNotFoundError } from '../errors';
import { UsersService } from '../services/users.service';
import type { MemberView } from '../types/member-view';

/**
 * `PATCH /api/users/:id` — edits a member's display name and/or role;
 * requires `users:update`. Demoting the last remaining active admin is
 * rejected with a 409 (the UI disables the control with the same rationale).
 */
@UseGuards(PermissionsGuard)
@RequirePermissions('users:update')
@Controller('users')
export class UpdateUserController {
    constructor(private readonly users: UsersService) {}

    @Patch(':id')
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: UpdateUserDto
    ): Promise<MemberView> {
        try {
            return await this.users.update(id, body);
        } catch (error) {
            if (error instanceof MemberNotFoundError) {
                throw new NotFoundException();
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
