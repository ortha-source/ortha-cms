import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcrypt';

/**
 * bcrypt cost factor. 12 is a deliberate 2026 default: expensive enough to
 * blunt offline cracking, cheap enough for an interactive login. Raising it
 * only affects newly written hashes — stored hashes carry their own cost.
 */
const SALT_ROUNDS = 12;

/**
 * Centralizes the plugin's hashing primitives so call sites inject one tested
 * provider instead of importing free functions. Two distinct jobs live behind
 * this facade: slow, salted **password** hashing (bcrypt) and fast, unsalted
 * **token** hashing (SHA-256) for opaque session ids.
 */
@Injectable()
export class HashingService {
    /**
     * Hashes a plaintext password with bcrypt. The result embeds the salt and
     * cost factor, so it is stored verbatim. The plaintext is never logged or
     * retained (FR-3). Note: bcrypt truncates input at 72 bytes.
     */
    async hashPassword(plain: string): Promise<string> {
        return hash(plain, SALT_ROUNDS);
    }

    /**
     * Verifies a plaintext password against a stored bcrypt hash in constant
     * time (delegated to bcrypt). A malformed/empty hash resolves to `false`
     * rather than throwing, so a corrupt row reads as "wrong password".
     */
    async verifyPassword(hashed: string, plain: string): Promise<boolean> {
        try {
            return await compare(plain, hashed);
        } catch {
            return false;
        }
    }

    /**
     * SHA-256 (hex) of a session token — what is persisted as the session row
     * key, never the raw token. Unsalted on purpose: the token is already
     * high-entropy, and a deterministic digest is what makes the by-id lookup
     * possible.
     */
    hashToken(token: string): string {
        return createHash('sha256').update(token).digest('hex');
    }
}
