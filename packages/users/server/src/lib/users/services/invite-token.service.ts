import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import { tokens } from '@ortha-cms/identity-server';
import { INVITE_TOKEN_TTL_DAYS } from '../users.constants';

/**
 * Issues and rotates the one-time invite tokens backing the invite flow,
 * stored in identity's `tokens` table. Mirrors identity's session convention:
 * only the SHA-256 of the raw token is persisted, so a read-only DB leak
 * yields nothing usable. The raw token is returned to the caller solely for
 * delivery (the invite email).
 */
@Injectable()
export class InviteTokenService {
    constructor(@InjectDatabase() private readonly db: Database) {}

    /**
     * Replaces any live invite tokens for the user with a fresh one — used
     * both on first invite and on resend, so at most one invite token is
     * valid per user at a time. Returns the raw token for delivery.
     */
    async rotate(userId: string): Promise<string> {
        const raw = randomBytes(32).toString('hex');
        const expiresAt = new Date(
            Date.now() + INVITE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
        );

        await this.db.transaction(async (tx) => {
            await tx
                .delete(tokens)
                .where(
                    and(eq(tokens.userId, userId), eq(tokens.type, 'invite'))
                );
            await tx.insert(tokens).values({
                type: 'invite',
                userId,
                tokenHash: this.hash(raw),
                expiresAt
            });
        });

        return raw;
    }

    private hash(raw: string): string {
        return createHash('sha256').update(raw).digest('hex');
    }
}
