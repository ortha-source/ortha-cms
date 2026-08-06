import {
    Body,
    Controller,
    Get,
    NotFoundException,
    Param,
    Post,
    Req,
    Res,
    UseGuards
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AcceptInviteUseCase } from '../../application/use-cases/accept-invite.use-case';
import {
    DescribeInviteUseCase,
    type InviteDescription
} from '../../application/use-cases/describe-invite.use-case';
import { InvalidInviteTokenError } from '../../domain/errors';
import { AcceptInviteDto } from '../dto/accept-invite.dto';
import { OriginGuard } from '../guards/origin.guard';
import { CookieService } from '../services/cookie.service';
import { Public } from '../decorators/public.decorator';

/**
 * The invite-acceptance pair, the only way a `pending` account becomes a real
 * one:
 *
 * - `GET /api/auth/invite/:token` — describes the invite so the accept screen
 *   can show who it is for. Read-only; opening the link twice is fine.
 * - `POST /api/auth/invite/accept` — sets the password, activates the account,
 *   and returns the session cookie so the invitee lands signed in.
 *
 * `@Public()` because an invitee has no session yet — that is the entire point.
 * Both routes are rate-limited (the token is a guessable-in-principle secret,
 * and accept runs bcrypt); accept additionally passes the `Origin` check, like
 * login, since it is a state-changing request a browser can be tricked into
 * making.
 *
 * Every invalid token — unknown, expired, already accepted, revoked — is one
 * generic 404 with no detail, so the endpoints cannot be used to discover which
 * invites are live.
 */
@Public()
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class InviteController {
    constructor(
        private readonly describeInvite: DescribeInviteUseCase,
        private readonly acceptInvite: AcceptInviteUseCase,
        private readonly cookies: CookieService
    ) {}

    @Get('invite/:token')
    async describe(@Param('token') token: string): Promise<InviteDescription> {
        try {
            return await this.describeInvite.execute(token);
        } catch (error) {
            throw this.toHttpError(error);
        }
    }

    @UseGuards(OriginGuard)
    @Post('invite/accept')
    async accept(
        @Body() body: AcceptInviteDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response
    ): Promise<{ ok: true }> {
        let session;
        try {
            session = await this.acceptInvite.execute(
                body.token,
                body.password,
                {
                    userAgent: req.headers['user-agent'] ?? null,
                    ipAddress: req.ip ?? null
                }
            );
        } catch (error) {
            throw this.toHttpError(error);
        }

        this.cookies.setSession(res, session.token);
        return { ok: true };
    }

    /** Collapses an invalid-token failure to a bare 404; passes the rest through. */
    private toHttpError(error: unknown): Error {
        if (error instanceof InvalidInviteTokenError) {
            return new NotFoundException();
        }
        return error instanceof Error ? error : new Error(String(error));
    }
}
