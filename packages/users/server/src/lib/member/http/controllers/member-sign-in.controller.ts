import {
    Controller,
    Get,
    NotFoundException,
    Param,
    ParseUUIDPipe,
    UseGuards
} from '@nestjs/common';
import {
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions
} from '@orthacms/identity-server';
import { MemberSignInQuery } from '../../infrastructure/queries/member-sign-in.query';
import type { MemberSignInView } from '../../application/queries/member.view';

/**
 * `GET /api/users/:id/sign-in` — whether the member has a password and which
 * SSO providers are linked: the member page's "Sign-in" summary.
 *
 * `users:update`, not `users:read`, for the reason identity gates the sessions
 * list the same way: how a colleague authenticates is account-security
 * metadata, not directory data, and `users:read` is held by every role. The
 * page shows this card only beside the controls that act on sign-in, which
 * need `users:update` anyway.
 */
@UseGuards(PermissionsGuard)
@RequirePermissions(PERMISSIONS.USERS_UPDATE)
@Controller('users')
export class MemberSignInController {
    constructor(private readonly signIn: MemberSignInQuery) {}

    @Get(':id/sign-in')
    async get(
        @Param('id', ParseUUIDPipe) id: string
    ): Promise<MemberSignInView> {
        const view = await this.signIn.byId(id);
        if (!view) {
            throw new NotFoundException();
        }
        return view;
    }
}
