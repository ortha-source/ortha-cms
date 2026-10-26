import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Post,
    UseGuards
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { RequestPasswordRecoveryUseCase } from '../../application/use-cases/request-password-recovery.use-case';
import { RequestPasswordRecoveryDto } from '../dto/request-password-recovery.dto';
import { OriginGuard } from '../guards/origin.guard';
import { Public } from '../decorators/public.decorator';

/** What `GET /api/auth/password-recovery` answers. */
export interface PasswordRecoveryAvailability {
    /** Whether the public form can send anything on this deployment. */
    available: boolean;
}

/**
 * The public "forgot your password?" pair (ADR-0018 phase 2):
 *
 * - `GET /api/auth/password-recovery` — whether this deployment sends recovery
 *   mail, so the sign-in page can offer the form or say who to ask instead. A
 *   property of the deployment, the same answer for everyone.
 * - `POST /api/auth/password-recovery` — asks for a reset link. Always `202`
 *   with the same body, whether or not an account uses the address: the work
 *   runs after the response ({@link RequestPasswordRecoveryUseCase.submit}).
 *   `404` when the deployment cannot send mail, as if the route were not there.
 *
 * `@Public()` — nobody who has forgotten a password has a session. Rate-limited
 * per source by the same `ThrottlerGuard` bucket as the other public auth
 * routes (a `429` with `Retry-After`, keyed on the caller, never the address),
 * and the request passes the `Origin` check like every state-changing one.
 */
@Public()
@UseGuards(ThrottlerGuard)
@Controller('auth/password-recovery')
export class PasswordRecoveryController {
    constructor(private readonly recovery: RequestPasswordRecoveryUseCase) {}

    @Get()
    availability(): PasswordRecoveryAvailability {
        return { available: this.recovery.isAvailable };
    }

    @UseGuards(OriginGuard)
    @Post()
    @HttpCode(HttpStatus.ACCEPTED)
    request(@Body() body: RequestPasswordRecoveryDto): { ok: true } {
        if (!this.recovery.isAvailable) {
            throw new NotFoundException();
        }
        this.recovery.submit(body.email);
        return { ok: true };
    }
}
