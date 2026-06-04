import {
    Body,
    Controller,
    Post,
    Req,
    Res,
    UnauthorizedException
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { IdentityPluginConfig } from '../types';
import { InjectIdentityConfig } from '../identity.tokens';
import { AuthService } from './auth.service';
import { InvalidCredentialsError } from './errors';
import { LoginDto } from './dto/login.dto';
import { setSessionCookie } from './cookie';

/**
 * `POST /api/auth/login` — validates credentials, persists a session, and sets
 * the `httpOnly` session cookie. On any failure responds with a generic 401
 * and creates no session. Mounted under the host's global `api` prefix.
 */
@Controller('auth')
export class LoginController {
    constructor(
        private readonly auth: AuthService,
        @InjectIdentityConfig() private readonly config: IdentityPluginConfig
    ) {}

    @Post('login')
    async login(
        @Body() body: LoginDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response
    ): Promise<{ ok: true }> {
        let session;
        try {
            session = await this.auth.login(body.email, body.password, {
                userAgent: req.headers['user-agent'] ?? null,
                ipAddress: req.ip ?? null
            });
        } catch (error) {
            if (error instanceof InvalidCredentialsError) {
                throw new UnauthorizedException('Invalid credentials');
            }
            throw error;
        }

        setSessionCookie(res, session.id, this.config.session);
        return { ok: true };
    }
}
