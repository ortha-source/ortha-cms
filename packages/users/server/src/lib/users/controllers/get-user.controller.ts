import {
    Controller,
    Get,
    NotFoundException,
    Param,
    ParseUUIDPipe,
    UseGuards
} from '@nestjs/common';
import {
    PermissionsGuard,
    RequirePermissions
} from '@ortha-cms/identity-server';
import { MemberNotFoundError } from '../errors';
import { UsersService } from '../services/users.service';
import type { MemberView } from '../types/member-view';

/**
 * `GET /api/users/:id` — one member's full view (role + workspaces +
 * `isLastAdmin`), backing the user detail page. Authorization is `users:read`,
 * matching the roster listing. An unknown id is a 404; we never leak whether
 * the id format simply failed to match a row vs. an unauthorized peek, since
 * the read surface is open to every signed-in member anyway.
 */
@UseGuards(PermissionsGuard)
@RequirePermissions('users:read')
@Controller('users')
export class GetUserController {
    constructor(private readonly users: UsersService) {}

    @Get(':id')
    async get(
        @Param('id', ParseUUIDPipe) id: string
    ): Promise<MemberView> {
        try {
            return await this.users.findById(id);
        } catch (error) {
            if (error instanceof MemberNotFoundError) {
                throw new NotFoundException();
            }
            throw error;
        }
    }
}
