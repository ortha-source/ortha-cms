import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * Credentials accepted by `POST /auth/login`. Validated by the host's global
 * `ValidationPipe` (`whitelist` + `forbidNonWhitelisted` + `transform`), so
 * any unknown field rejects the request before it reaches the controller.
 */
export class LoginDto {
    /** Login email; matched case-insensitively against stored users. */
    @ApiProperty({
        type: String,
        format: 'email',
        example: 'ada@example.com',
        description:
            'Login email, matched case-insensitively against stored users.'
    })
    @IsEmail()
    email!: string;

    /** Plaintext password, verified against the stored bcrypt hash. */
    @ApiProperty({
        type: String,
        format: 'password',
        minLength: 1,
        description:
            'Plaintext password, verified against the stored bcrypt hash. Wrong email and wrong password fail identically (no enumeration signal).'
    })
    @IsString()
    @IsNotEmpty()
    password!: string;
}
