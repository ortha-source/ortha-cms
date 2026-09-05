import { createHash } from 'node:crypto';
import { HashingService } from './hashing.service';

/**
 * `HashingService` — the plugin's two hashing primitives, which are deliberately
 * *not* the same primitive: slow salted bcrypt for passwords, fast unsalted
 * SHA-256 for opaque session tokens.
 *
 * Two invariants are load-bearing for authentication itself:
 *
 * - **`verifyPassword` never throws.** It is called on every login with whatever
 *   is in the row. A corrupt, truncated or empty `password_hash` must read as
 *   "wrong password", because a rejected promise here becomes a 500 — which
 *   both breaks the login and tells an attacker they found an account whose
 *   stored hash is malformed. A boolean `false` says nothing.
 * - **`hashToken` is a plain, deterministic SHA-256 (identity:I-09).** Determinism is
 *   what makes the session lookup a by-id read instead of a table scan; that it
 *   is a *digest* is what makes the stored value useless to whoever reads the
 *   row, since only the digest is persisted and never the token.
 *
 * bcrypt at the service's cost factor is ~350ms per operation, so the password
 * suite hashes once and reuses the result, and the timeout is raised to suit.
 */
describe('HashingService', () => {
    jest.setTimeout(30_000);

    const PASSWORD = 'correct horse battery staple';

    function service(): HashingService {
        return new HashingService();
    }

    /**
     * One real bcrypt hash of {@link PASSWORD}, computed at most once for the
     * whole file — the fixture every `verifyPassword` case reads from.
     */
    let storedHash: Promise<string> | null = null;
    function hashOfPassword(): Promise<string> {
        storedHash ??= service().hashPassword(PASSWORD);
        return storedHash;
    }

    describe('verifyPassword', () => {
        it('accepts the password the stored hash was made from', async () => {
            await expect(
                service().verifyPassword(await hashOfPassword(), PASSWORD)
            ).resolves.toBe(true);
        });

        it.each([
            ['a different password', 'incorrect horse battery staple'],
            ['the right password with a trailing space', `${PASSWORD} `],
            ['a prefix of the right password', PASSWORD.slice(0, -1)],
            ['an empty password', '']
        ])('rejects %s', async (_label, attempt) => {
            await expect(
                service().verifyPassword(await hashOfPassword(), attempt)
            ).resolves.toBe(false);
        });

        it.each([
            ['an empty hash', ''],
            ['a hash that is not bcrypt at all', 'not-a-bcrypt-hash'],
            ['a truncated bcrypt hash', '$2b$12$short'],
            ['a null hash', null],
            ['an undefined hash', undefined]
        ])(
            'resolves false rather than throwing on %s',
            async (_label, stored) => {
                await expect(
                    service().verifyPassword(
                        stored as unknown as string,
                        PASSWORD
                    )
                ).resolves.toBe(false);
            }
        );
    });

    describe('hashToken', () => {
        it('returns the same digest for the same token', () => {
            const hashing = service();
            expect(hashing.hashToken('a-session-token')).toBe(
                hashing.hashToken('a-session-token')
            );
        });

        it('returns the same digest across instances', () => {
            expect(service().hashToken('a-session-token')).toBe(
                service().hashToken('a-session-token')
            );
        });

        it('matches the published SHA-256 vector for "abc"', () => {
            expect(service().hashToken('abc')).toBe(
                'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
            );
        });

        it('matches the published SHA-256 vector for the empty string', () => {
            expect(service().hashToken('')).toBe(
                'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
            );
        });

        it('is unsalted — it agrees with a bare SHA-256 of the token', () => {
            const token = 'ZbK9-opaque-session-token';
            expect(service().hashToken(token)).toBe(
                createHash('sha256').update(token).digest('hex')
            );
        });

        it('does not echo the token back', () => {
            const token = 'ZbK9-opaque-session-token';
            const digest = service().hashToken(token);
            expect(digest).not.toBe(token);
            expect(digest).not.toContain(token);
        });

        it('emits 64 lower-case hex characters', () => {
            expect(service().hashToken('a-session-token')).toMatch(
                /^[0-9a-f]{64}$/
            );
        });

        it('separates tokens that differ by a single character', () => {
            const hashing = service();
            expect(hashing.hashToken('token-a')).not.toBe(
                hashing.hashToken('token-b')
            );
        });
    });
});
