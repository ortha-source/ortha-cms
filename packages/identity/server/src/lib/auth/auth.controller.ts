import {
    Body,
    Controller,
    Get,
    Post,
    Req,
    Res,
    UnauthorizedException
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { IdentityPluginConfig } from '../types';
import { InjectIdentityConfig } from '../identity.tokens';
import { AuthService, type PublicUser } from './auth.service';
import { InvalidCredentialsError } from './errors';
import { LoginDto } from './dto/login.dto';

/** Name of the opaque session cookie. */
const SESSION_COOKIE = 'ortha_session';

/**
 * Authentication endpoints. Mounted under the host's global `api` prefix, so
 * the live paths are `POST /api/auth/login` and `GET /api/auth/me`.
 *
 * Cookie reading here is intentionally hand-rolled (no `cookie-parser`) to
 * keep this ticket self-contained; the auth-guard ticket owns introducing
 * request-side session middleware.
 */
@Controller('auth')
export class AuthController {
    constructor(
        private readonly auth: AuthService,
        @InjectIdentityConfig() private readonly config: IdentityPluginConfig
    ) {}

    /**
     * Validates credentials, persists a session, and sets the `httpOnly`
     * session cookie. On any failure responds with a generic 401 and creates
     * no session. Cookie attributes and lifetime come from config, never
     * literals.
     */
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

        const { session: cookie } = this.config;
        res.cookie(SESSION_COOKIE, session.id, {
            httpOnly: true,
            secure: cookie.cookieSecure,
            sameSite: cookie.cookieSameSite,
            maxAge: cookie.ttlSeconds * 1000,
            path: '/'
        });

        return { ok: true };
    }

    /**
     * Returns the current user resolved from the session cookie, or a generic
     * 401 when there is no valid session. Useful for the admin app to decide
     * auth state on load.
     */
    @Get('me')
    async me(@Req() req: Request): Promise<PublicUser> {
        const sessionId = this.readSessionCookie(req);
        const user = sessionId
            ? await this.auth.currentUser(sessionId)
            : null;

        if (!user) {
            throw new UnauthorizedException();
        }
        return user;
    }

    /** Extracts the session token from the raw `Cookie` header, if present. */
    private readSessionCookie(req: Request): string | null {
        const header = req.headers.cookie;
        if (!header) {
            return null;
        }
        for (const part of header.split(';')) {
            const eq = part.indexOf('=');
            if (eq === -1) {
                continue;
            }
            if (part.slice(0, eq).trim() === SESSION_COOKIE) {
                return part.slice(eq + 1).trim() || null;
            }
        }
        return null;
    }
}
