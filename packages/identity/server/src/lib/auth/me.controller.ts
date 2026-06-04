import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, type PublicUser } from './auth.service';
import { CookieService } from './cookie.service';

/**
 * `GET /api/auth/me` — returns the current user resolved from the session
 * cookie, or a generic 401 when there is no valid session. Useful for the
 * admin app to decide auth state on load.
 */
@Controller('auth')
export class MeController {
    constructor(
        private readonly auth: AuthService,
        private readonly cookies: CookieService
    ) {}

    @Get('me')
    async me(@Req() req: Request): Promise<PublicUser> {
        const sessionId = this.cookies.readSession(req);
        const user = sessionId
            ? await this.auth.currentUser(sessionId)
            : null;

        if (!user) {
            throw new UnauthorizedException();
        }
        return user;
    }
}
