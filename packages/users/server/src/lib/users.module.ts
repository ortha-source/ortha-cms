import { DynamicModule, Module } from '@nestjs/common';
import { ListUsersController } from './users/controllers/list-users.controller';
import { InviteUserController } from './users/controllers/invite-user.controller';
import { UpdateUserController } from './users/controllers/update-user.controller';
import { SetUserStatusController } from './users/controllers/set-user-status.controller';
import { ResendInviteController } from './users/controllers/resend-invite.controller';
import { RevokeInviteController } from './users/controllers/revoke-invite.controller';
import { UsersService } from './users/services/users.service';
import { InviteTokenService } from './users/services/invite-token.service';

/**
 * NestJS module for the users plugin. Mounts the member-management routes
 * under `/api/users` and their services. The services are private to this
 * module — nothing else injects them — so the module is neither global nor
 * exports anything.
 *
 * The Drizzle client comes from `@ortha-cms/database`'s global
 * `DatabaseModule` (`@InjectDatabase()`); authentication from identity's
 * global `AuthGuard`; and authorization from identity's `PermissionsGuard`,
 * bound per controller with `@RequirePermissions(…)` (its `PermissionsService`
 * dependency resolves from identity's global module). It takes no config:
 * the invite TTL and page sizes are deliberate constants, not host knobs.
 */
@Module({})
export class UsersModule {
    /** Creates the dynamic module: the member services + their controllers. */
    static forRoot(): DynamicModule {
        return {
            module: UsersModule,
            controllers: [
                ListUsersController,
                InviteUserController,
                UpdateUserController,
                SetUserStatusController,
                ResendInviteController,
                RevokeInviteController
            ],
            providers: [UsersService, InviteTokenService]
        };
    }
}
