import { InvalidPasswordHashError } from '../errors';
import { PasswordHash } from './password-hash';

const BCRYPT_HASH =
    '$2b$12$C6UzMDM.H6dfI/f/IKcEeO1Qh6b6q0hSbLoUuwF5vGO8VC/2mS9Iu';

/**
 * The aggregate's guard against a *missing* credential slipping in as an empty
 * string, which would otherwise persist as a hash nothing can verify against.
 * It deliberately does not police the bcrypt format: the authoritative check is
 * whether the digest verifies at login, and a cost/prefix assertion here would
 * break a rehash without adding safety.
 *
 * Which is why this file does not cite the identity dossier's I-09 ("no secret
 * is stored in the clear; passwords are bcrypt(12)"), though it reads as if it
 * should: `PasswordHash.create` accepts any non-blank string, so it would take a
 * plaintext password without complaint. I-09 is pinned where a real hash is
 * produced and read back — `auth/services/hashing.service.spec.ts` and
 * `apps/server-e2e/src/server/auth/password-reset.spec.ts`.
 */
describe('PasswordHash', () => {
    describe('create', () => {
        it('carries a bcrypt digest verbatim', () => {
            expect(PasswordHash.create(BCRYPT_HASH).value).toBe(BCRYPT_HASH);
        });

        it.each([
            ['an empty string', ''],
            ['spaces', '   '],
            ['a tab and a newline', '\t\n']
        ])('rejects %s', (_case, value) => {
            expect(() => PasswordHash.create(value)).toThrow(
                InvalidPasswordHashError
            );
        });
    });

    describe('equals', () => {
        it('is structural on the underlying hash', () => {
            expect(
                PasswordHash.create(BCRYPT_HASH).equals(
                    PasswordHash.create(BCRYPT_HASH)
                )
            ).toBe(true);
            expect(
                PasswordHash.create(BCRYPT_HASH).equals(
                    PasswordHash.create('$2b$12$adifferentdigestentirely')
                )
            ).toBe(false);
        });
    });
});
