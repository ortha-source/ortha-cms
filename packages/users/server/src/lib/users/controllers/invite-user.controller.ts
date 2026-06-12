import {
    Body,
    ConflictException,
    Controller,
    Post,
    UseGuards
} from '@nestjs/common';
import {
    PermissionsGuard,
    RequirePermissions
} from '@ortha-cms/identity-server';
import { InviteUserDto } from '../dto/invite-user.dto';
import { EmailTakenError } from '../errors';
import { UsersService } from '../services/users.service';
import type { MemberView } from '../types/member-view';

/**
 * `POST /api/users/invites` — invites a person by email. Creates the pending
 * member and issues their invite token; requires `users:create`. Returns the
 * new member row so the admin list can show it immediately with its
 * "Invited" status.
 */
@UseGuards(PermissionsGuard)
@RequirePermissions('users:create')
@Controller('users')
export class InviteUserController {
    constructor(private readonly users: UsersService) {}

    @Post('invites')
    async invite(@Body() body: InviteUserDto): Promise<MemberView> {
        try {
            return await this.users.invite(body);
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
