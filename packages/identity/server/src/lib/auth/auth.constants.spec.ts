import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
    MAX_PASSWORD_LENGTH,
    MIN_PASSWORD_LENGTH,
    passwordByteLength
} from './auth.constants';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { HashingService } from './services/hashing.service';
import { PasswordTooLongError } from './errors/password-too-long.error';

/**
 * The credential-length rule, and specifically the **unit** each bound is
 * counted in. The floor is characters; the ceiling is bcrypt's 72-byte
 * truncation point, and conflating the two is BUG-identity-server-03: a
 * 72-character accented passphrase is 144 bytes, so a character-counted
 * ceiling accepted it and bcrypt then protected the account with half of it.
 */
describe('password length rule', () => {
    describe('passwordByteLength', () => {
        it('matches String#length for ASCII', () => {
            expect(passwordByteLength('correct horse')).toBe(13);
        });

        it('counts a two-byte character as two', () => {
            expect('é'.repeat(72)).toHaveLength(72);
            expect(passwordByteLength('é'.repeat(72))).toBe(144);
        });

        it('counts an astral emoji as four bytes, not its two code units', () => {
            expect('🔑').toHaveLength(2);
            expect(passwordByteLength('🔑')).toBe(4);
        });

        it('is zero for the empty string', () => {
            expect(passwordByteLength('')).toBe(0);
        });
    });

    describe('AcceptInviteDto', () => {
        /** Runs the DTO's validators and returns the failing property names. */
        async function failingFields(password: string): Promise<string[]> {
            const dto = plainToInstance(AcceptInviteDto, {
                token: 'a'.repeat(64),
                password,
                confirmPassword: password
            });
            const errors = await validate(dto);
            return errors.map((error) => error.property);
        }

        it('accepts the exact character floor', async () => {
            await expect(
                failingFields('a'.repeat(MIN_PASSWORD_LENGTH))
            ).resolves.toEqual([]);
        });

        it('rejects one character under the floor', async () => {
            await expect(
                failingFields('a'.repeat(MIN_PASSWORD_LENGTH - 1))
            ).resolves.toEqual(['password']);
        });

        it('accepts the exact byte ceiling', async () => {
            await expect(
                failingFields('a'.repeat(MAX_PASSWORD_LENGTH))
            ).resolves.toEqual([]);
        });

        it('rejects one byte over the ceiling', async () => {
            await expect(
                failingFields('a'.repeat(MAX_PASSWORD_LENGTH + 1))
            ).resolves.toEqual(['password']);
        });

        it('rejects a 72-character passphrase that is 144 bytes', async () => {
            // The regression itself: within the ceiling by `.length`, double it
            // by the measure bcrypt uses.
            await expect(failingFields('é'.repeat(72))).resolves.toEqual([
                'password'
            ]);
        });

        it('accepts a multibyte passphrase that fits the byte budget', async () => {
            // 24 two-byte characters = 48 bytes. Non-ASCII is not the problem;
            // exceeding the budget is.
            await expect(failingFields('é'.repeat(24))).resolves.toEqual([]);
        });
    });

    describe('HashingService.hashPassword', () => {
        const hashing = new HashingService();

        it('hashes a password inside the byte budget', async () => {
            const stored = await hashing.hashPassword('correct horse battery');
            expect(stored).toMatch(/^\$2[aby]\$12\$/);
            await expect(
                hashing.verifyPassword(stored, 'correct horse battery')
            ).resolves.toBe(true);
        });

        it('refuses a password past the byte budget rather than truncating', async () => {
            // The backstop for the paths with no DTO — the routeless
            // `ChangePasswordUseCase` and the root-admin bootstrap, which reads
            // its password straight from the environment.
            await expect(
                hashing.hashPassword('é'.repeat(72))
            ).rejects.toBeInstanceOf(PasswordTooLongError);
        });

        it('carries no plaintext in the error it throws', async () => {
            const secret = `${'é'.repeat(72)}hunter2`;
            await expect(hashing.hashPassword(secret)).rejects.toThrow(
                /^Password exceeds 72 bytes/
            );
            await expect(hashing.hashPassword(secret)).rejects.not.toThrow(
                /hunter2/
            );
        });
    });
});
