import {
    Body,
    Controller,
    Get,
    NotFoundException,
    Param,
    Post,
    UseGuards
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
    DescribePasswordResetUseCase,
    type PasswordResetDescription
} from '../../application/use-cases/describe-password-reset.use-case';
import { ResetPasswordUseCase } from '../../application/use-cases/reset-password.use-case';
import { InvalidResetTokenError } from '../../domain/errors';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { OriginGuard } from '../guards/origin.guard';
import { Public } from '../decorators/public.decorator';

/**
 * The password-reset redemption pair — the second half of the flow an admin
 * starts from a member's Access tab (`POST /api/users/:id/password-reset`,
 * which mints the link):
 *
 * - `GET /api/auth/reset/:token` — names the account the link resets, so the
 *   screen can show it before a password is typed. Read-only; opening the link
 *   twice is fine.
 * - `POST /api/auth/reset` — sets the new password and revokes every live
 *   session on the account.
 *
 * `@Public()` because someone who has lost their password has no session — that
 * is the entire point. Both routes are rate-limited (the token is a
 * guessable-in-principle secret, and the redemption runs bcrypt); the
 * redemption additionally passes the `Origin` check, like login, since it is a
 * state-changing request a browser can be tricked into making.
 *
 * Unlike accepting an invite, redeeming a reset sets **no** session cookie: the
 * caller has proven only that they hold a link, so they finish at the sign-in
 * form with the credential they just chose.
 *
 * Every invalid token — unknown, expired, already used, or issued for an
 * account that is no longer active — is one generic 404 with no detail, so the
 * endpoints cannot be used to discover which links are live or which accounts
 * exist.
 */
@Public()
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class PasswordResetController {
    constructor(
        private readonly describeReset: DescribePasswordResetUseCase,
        private readonly resetPassword: ResetPasswordUseCase
    ) {}

    @Get('reset/:token')
    async describe(
        @Param('token') token: string
    ): Promise<PasswordResetDescription> {
        try {
            return await this.describeReset.execute(token);
        } catch (error) {
            throw this.toHttpError(error);
        }
    }

    @UseGuards(OriginGuard)
    @Post('reset')
    async reset(@Body() body: ResetPasswordDto): Promise<{ ok: true }> {
        try {
            await this.resetPassword.execute(body.token, body.password);
        } catch (error) {
            throw this.toHttpError(error);
        }
        // Deliberately no session-eviction count in the response: the caller is
        // unauthenticated, and how many devices the account had signed in is
        // not theirs to learn. It is on the audit row instead.
        return { ok: true };
    }

    /** Collapses an invalid-token failure to a bare 404; passes the rest through. */
    private toHttpError(error: unknown): Error {
        if (error instanceof InvalidResetTokenError) {
            return new NotFoundException();
        }
        return error instanceof Error ? error : new Error(String(error));
    }
}
