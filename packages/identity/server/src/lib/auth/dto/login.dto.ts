import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * Credentials accepted by `POST /auth/login`. Validated by the host's global
 * `ValidationPipe` (`whitelist` + `forbidNonWhitelisted` + `transform`), so
 * any unknown field rejects the request before it reaches the controller.
 */
export class LoginDto {
    /** Login email; matched case-insensitively against stored users. */
    @IsEmail()
    email!: string;

    /** Plaintext password, verified against the stored bcrypt hash. */
    @IsString()
    @IsNotEmpty()
    password!: string;
}
