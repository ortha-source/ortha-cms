import { Inject, Injectable } from '@nestjs/common';
import {
    PASSWORD_RESET_REPOSITORY,
    type PasswordResetRepository
} from '../../domain/password-reset.repository';
import { InvalidResetTokenError } from '../../domain/errors';
import { HashingService } from '../../auth/services/hashing.service';

/**
 * What the reset screen renders back to the person following the link. Shown,
 * never collected — a reset changes one thing, and it is not who you are.
 */
export interface PasswordResetDescription {
    /** The email of the account the link resets. */
    email: string;
    /** The account's display name, or `null` when it has none. */
    name: string | null;
}

/**
 * Resolves a reset link's raw token to the account it stands for, so the screen
 * can name that account before any password is typed — someone holding a link
 * they were handed out-of-band should be able to see it is for the right
 * address before committing to it. A pure read — it does **not** consume the
 * token, so opening the link twice (or refreshing the page) is harmless.
 *
 * Every failure mode — unknown, expired, already used, revoked — raises the
 * same {@link InvalidResetTokenError}, which the controller renders as one
 * generic 404. Nothing here distinguishes them, so the endpoint cannot be used
 * to probe for live reset links.
 */
@Injectable()
export class DescribePasswordResetUseCase {
    constructor(
        private readonly hashing: HashingService,
        @Inject(PASSWORD_RESET_REPOSITORY)
        private readonly resets: PasswordResetRepository
    ) {}

    /** Describes the reset `rawToken` stands for, or throws. */
    async execute(rawToken: string): Promise<PasswordResetDescription> {
        const reset = await this.resets.findPendingByTokenHash(
            this.hashing.hashToken(rawToken)
        );
        if (!reset) {
            throw new InvalidResetTokenError();
        }
        return { email: reset.email, name: reset.name };
    }
}
