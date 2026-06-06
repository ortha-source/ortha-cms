import { Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { CookieService } from '../services/cookie.service';
import { OriginGuard } from '../guards/origin.guard';

/**
 * `POST /api/auth/logout` — revokes the caller's session (if any) and clears
 * the session cookie. Idempotent: with no or an invalid session it still
 * succeeds and clears the cookie, so a double-submit or an already-expired
 * session is a no-op rather than an error. `Origin`-guarded as a CSRF defense.
 * Only the presented session is revoked — the user's other sessions (e.g. on
 * another device) stay valid.
 */
@UseGuards(OriginGuard)
@Controller('auth')
export class LogoutController {
    constructor(
        private readonly auth: AuthService,
        private readonly cookies: CookieService
    ) {}

    @Post('logout')
    async logout(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response
    ): Promise<{ ok: true }> {
        const token = this.cookies.readSession(req);
        if (token) {
            await this.auth.logout(token);
        }
        this.cookies.clearSession(res);
        return { ok: true };
    }
}
