import { IsEmail, MaxLength } from 'class-validator';

/**
 * The body accepted by `POST /auth/password-recovery` — the public "forgot your
 * password?" form.
 *
 * A malformed address is a `400` like anywhere else: whether a string *looks*
 * like an email says nothing about whether an account uses it, so validating it
 * is not an enumeration signal. Everything past validation answers the same.
 */
export class RequestPasswordRecoveryDto {
    /** The address to send a reset link to, if an active account uses it. */
    @IsEmail()
    @MaxLength(320)
    email!: string;
}
