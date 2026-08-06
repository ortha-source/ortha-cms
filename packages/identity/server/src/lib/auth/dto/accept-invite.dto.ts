import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '../auth.constants';
import { MatchesField } from './matches-field.validator';

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

    /** The password to set as this account's first credential. */
    @IsString()
    @MinLength(MIN_PASSWORD_LENGTH)
    @MaxLength(MAX_PASSWORD_LENGTH)
    password!: string;

    /**
     * Re-typed password. Checked server-side too, not just in the form — the
     * endpoint is public, and a mismatch here means the user does not know the
     * credential they are about to be locked into.
     */
    @IsString()
    @MatchesField('password', {
        message: 'confirmPassword must match password'
    })
    confirmPassword!: string;
}
