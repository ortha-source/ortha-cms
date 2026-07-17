import { Inject, Injectable } from '@nestjs/common';
import { OutboxWriter, UnitOfWork } from '@ortha-cms/database';
import { UserId } from '../../domain/value-objects/user-id';
import { PasswordHash } from '../../domain/value-objects/password-hash';
import { UserAccountNotFoundError } from '../../domain/errors';
import {
    USER_ACCOUNT_REPOSITORY,
    type UserAccountRepository
} from '../../domain/user-account.repository';
import { HashingService } from '../../auth/services/hashing.service';

/**
 * Changes a user account's password. Loads the {@link UserAccount} aggregate,
 * applies {@link UserAccount.changeCredential} (which enforces the "not while
 * disabled" invariant and raises `user.password_changed`), persists it, and
 * drains the event to the outbox — all in one unit of work.
 *
 * No HTTP route wires this yet (password reset / self-service change land in a
 * later ticket); it is the aggregate's credential-change flow, ready for that
 * controller and exercised by the domain unit tests today.
 */
@Injectable()
export class ChangePasswordUseCase {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly outbox: OutboxWriter,
        private readonly hashing: HashingService,
        @Inject(USER_ACCOUNT_REPOSITORY)
        private readonly accounts: UserAccountRepository
    ) {}

    /** Hashes `newPassword` and sets it as `userId`'s credential. */
    async execute(userId: string, newPassword: string): Promise<void> {
        const id = UserId.create(userId);
        const passwordHash = PasswordHash.create(
            await this.hashing.hashPassword(newPassword)
        );

        await this.uow.run(async () => {
            const account = await this.accounts.findById(id);
            if (!account) {
                throw new UserAccountNotFoundError(userId);
            }
            account.changeCredential(passwordHash);
            await this.accounts.save(account);
            await this.outbox.append(account.pullEvents());
        });
    }
}
