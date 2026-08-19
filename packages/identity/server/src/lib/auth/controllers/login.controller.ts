import {
    Body,
    Controller,
    Post,
    Req,
    Res,
    UnauthorizedException,
    UseGuards
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { InvalidCredentialsError } from '../errors';
import { LoginDto } from '../dto/login.dto';
import { OriginGuard } from '../guards/origin.guard';
import { CookieService } from '../services/cookie.service';
import { Public } from '../decorators/public.decorator';

/**
 * `POST /api/auth/login` — validates credentials, persists a session, and sets
 * the `httpOnly` session cookie. On any failure responds with a generic 401
 * and creates no session. Mounted under the host's global `api` prefix.
 *
 * `@Public()` so the app-wide `AuthGuard` lets it through (logging in needs no
 * session). Still guarded by a rate limit (brute-force + bcrypt CPU-DoS) and an
 * `Origin` check (login CSRF).
 */
@Public()
@UseGuards(ThrottlerGuard, OriginGuard)
@Controller('auth')
export class LoginController {
    constructor(
        private readonly loginUseCase: LoginUseCase,
        private readonly cookies: CookieService
    ) {}

    @Post('login')
    async login(
        @Body() body: LoginDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response
    ): Promise<{ ok: true }> {
        let session;
        try {
            session = await this.loginUseCase.execute(
                body.email,
                body.password,
                {
                    userAgent: req.headers['user-agent'] ?? null,
                    ipAddress: req.ip ?? null
                }
            );
        } catch (error) {
            if (error instanceof InvalidCredentialsError) {
                throw new UnauthorizedException('Invalid credentials');
            }
            throw error;
        }

        this.cookies.setSession(res, session.token);
        return { ok: true };
    }
}
