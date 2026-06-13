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
import {
    InvalidMemberStateError,
    LastAdminProtectedError,
    MemberNotFoundError,
    SelfActionError
} from '../errors';
import { UsersService } from '../services/users.service';
import type { MemberView } from '../types/member-view';

/**
 * `POST /api/users/:id/disable` and `POST /api/users/:id/enable` — flips a
 * member's account between active and disabled; requires `users:update`.
 * One controller for the pair: they are the same use case (status), share
 * every dependency, and mirror each other's error mapping. Self-disable and
 * disabling the last active admin are rejected with a 409.
 */
@UseGuards(PermissionsGuard)
@RequirePermissions('users:update')
@Controller('users')
export class SetUserStatusController {
    constructor(private readonly users: UsersService) {}

    @Post(':id/disable')
    async disable(
        @CurrentUser() actor: PublicUser,
        @Param('id', ParseUUIDPipe) id: string
    ): Promise<MemberView> {
        try {
            return await this.users.disable(actor, id);
        } catch (error) {
            throw mapStatusError(error);
        }
    }

    @Post(':id/enable')
    async enable(
        @CurrentUser() actor: PublicUser,
        @Param('id', ParseUUIDPipe) id: string
    ): Promise<MemberView> {
        try {
            return await this.users.enable(actor, id);
        } catch (error) {
            throw mapStatusError(error);
        }
    }
}

/** Maps the status-change domain errors to HTTP; re-throws the rest. */
function mapStatusError(error: unknown): Error {
    if (error instanceof MemberNotFoundError) {
        return new NotFoundException();
    }
    if (error instanceof SelfActionError) {
        return new ConflictException('You cannot disable your own account');
    }
    if (error instanceof LastAdminProtectedError) {
        return new ConflictException(
            'The last remaining admin cannot be disabled'
        );
    }
    if (error instanceof InvalidMemberStateError) {
        return new ConflictException(error.message);
    }
    return error instanceof Error ? error : new Error(String(error));
}
