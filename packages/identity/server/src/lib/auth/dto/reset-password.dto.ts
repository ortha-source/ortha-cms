import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '../auth.constants';
import { MatchesField } from './matches-field.validator';
import { MaxByteLength } from './max-byte-length.validator';

/**
 * The body accepted by `POST /auth/reset`. Validated by the host's global
 * `ValidationPipe` (`whitelist` + `forbidNonWhitelisted` + `transform`), so any
 * unknown field rejects the request before it reaches the controller.
 *
 * Only a password is collected. Which account is being reset is carried by the
 * token, never by the body — a caller cannot name a different account than the
 * one their link was issued for.
 */
export class ResetPasswordDto {
    /** The raw one-time token from the reset link. */
    @IsString()
    @IsNotEmpty()
    token!: string;

    /**
     * The password to set as this account's credential. The floor is counted in
     * characters; the ceiling is counted in **bytes**, because that is the unit
     * bcrypt truncates on — `@MaxLength` would wave through a 72-character
     * accented passphrase that is 144 bytes and let bcrypt discard half of it.
     */
    @IsString()
    @MinLength(MIN_PASSWORD_LENGTH)
    @MaxByteLength(MAX_PASSWORD_LENGTH)
    password!: string;

    /**
     * Re-typed password. Checked server-side too, not just in the form — the
     * endpoint is public, and a mismatch here means the user does not know the
     * credential they are about to be locked into, with the link that would have
     * let them try again already spent.
     */
    @IsString()
    @MatchesField('password', {
        message: 'confirmPassword must match password'
    })
    confirmPassword!: string;
}
