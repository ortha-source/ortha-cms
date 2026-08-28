import { InvalidPasswordHashError } from '../errors';
import { PasswordHash } from './password-hash';

const BCRYPT_HASH =
    '$2b$12$C6UzMDM.H6dfI/f/IKcEeO1Qh6b6q0hSbLoUuwF5vGO8VC/2mS9Iu';

/**
 * И-09: no secret is stored in the clear — the password is only ever a bcrypt
 * digest. This value object is the aggregate's guard against a *missing*
 * credential slipping in as an empty string, which would otherwise persist as a
 * hash nothing can verify against. It deliberately does not police the bcrypt
 * format: the authoritative check is whether the digest verifies at login, and
 * a cost/prefix assertion here would break a rehash without adding safety.
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
