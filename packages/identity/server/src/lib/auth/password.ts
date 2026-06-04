import { compare, hash } from 'bcrypt';

/**
 * bcrypt cost factor. 12 is a deliberate 2026 default: expensive enough to
 * blunt offline cracking, cheap enough for an interactive login. Raising it
 * only affects newly written hashes — stored hashes carry their own cost.
 */
const SALT_ROUNDS = 12;

/**
 * Hashes a plaintext password with bcrypt. The returned string embeds the
 * salt and cost factor, so it is stored verbatim in `users.password_hash`.
 * The plaintext is never logged or retained (FR-3).
 *
 * Note: bcrypt truncates input at 72 bytes — acceptable for password use.
 */
export async function hashPassword(plain: string): Promise<string> {
    return hash(plain, SALT_ROUNDS);
}

/**
 * Verifies a plaintext password against a stored bcrypt hash. The comparison
 * is constant-time within the hash length (delegated to bcrypt). A malformed
 * or empty hash resolves to `false` rather than throwing, so a corrupt row
 * reads as "wrong password" instead of surfacing a 500.
 */
export async function verifyPassword(
    hashed: string,
    plain: string
): Promise<boolean> {
    try {
        return await compare(plain, hashed);
    } catch {
        return false;
    }
}
