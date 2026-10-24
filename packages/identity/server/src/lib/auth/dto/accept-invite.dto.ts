import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '../auth.constants';
import { MatchesField } from './matches-field.validator';
import { MaxByteLength } from './max-byte-length.validator';

/**
 * The body accepted by `POST /auth/invite/accept`. Validated by the host's
 * global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted` + `transform`),
 * so any unknown field rejects the request before it reaches the controller.
 *
 * Only a password is collected: the account's email, display name, role, and
 * workspaces were all fixed by the inviting admin, so nothing the invitee sends
 * can change who they are or what they may do.
 */
export class AcceptInviteDto {
    /** The raw one-time token from the invite link. */
    @IsString()
    @IsNotEmpty()
    token!: string;

    /**
     * The password to set as this account's first credential. The floor is
     * counted in characters; the ceiling is counted in **bytes**, because that
     * is the unit bcrypt truncates on — `@MaxLength` would wave through a
     * 72-character accented passphrase that is 144 bytes and let bcrypt discard
     * half of it.
     */
    @IsString()
    @MinLength(MIN_PASSWORD_LENGTH)
    @MaxByteLength(MAX_PASSWORD_LENGTH)
    password!: string;

    /**
     * Re-typed password — **optional** since the R7 auth redesign. The screens
     * now collect one password field with a strength meter and a show-password
     * toggle instead of asking for it twice: the toggle is what lets someone
     * check the credential they are about to be locked into, and it does so
     * without making them type it again.
     *
     * When a client still sends it, it must match — checked server-side, not
     * just in a form, because the endpoint is public and a mismatch means the
     * caller does not know the password they are setting. `@IsOptional()` skips
     * the rules only for an absent (or `null`) value; an empty string is still
     * a mismatch.
     */
    @IsOptional()
    @IsString()
    @MatchesField('password', {
        message: 'confirmPassword must match password'
    })
    confirmPassword?: string;
}
