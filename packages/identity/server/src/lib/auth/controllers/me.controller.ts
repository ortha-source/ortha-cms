import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { PublicUser } from '../services/auth.service';

/**
 * `GET /api/auth/me` — returns the current user. Authentication is handled by
 * the app-wide {@link AuthGuard}: it resolves the session cookie, 401s when
 * there is no valid session, and attaches the user, which `@CurrentUser()`
 * reads here. Used by the admin app to decide auth state on load.
 */
@Controller('auth')
export class MeController {
    @Get('me')
    me(@CurrentUser() user: PublicUser): PublicUser {
        return user;
    }
}
