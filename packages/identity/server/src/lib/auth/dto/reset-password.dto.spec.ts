import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { AcceptInviteDto } from './accept-invite.dto';
import { ResetPasswordDto } from './reset-password.dto';

/**
 * `ResetPasswordDto` — the body of `POST /auth/reset`, and the second place a
 * password is chosen without an existing credential to compare against.
 *
 * The invariant (И-11) is that the *reset* path enforces exactly the bounds the
 * *invite accept* path does. Two public endpoints that both set a first-class
 * credential must not disagree about what a password is: a rule tightened on
 * one and forgotten on the other means an account can be walked below the floor
 * by picking the other door. So both DTOs are driven through the same table,
 * and a divergence fails here rather than in production.
 *
 * Exercised through `plainToInstance` + `validate()` — the same pair the host's
 * global `ValidationPipe` runs, so what passes here is what the pipe accepts.
 */
describe('ResetPasswordDto (against AcceptInviteDto)', () => {
    /** Both DTOs that set a first credential; the table below runs on each. */
    const dtos = [
        ['ResetPasswordDto', ResetPasswordDto],
        ['AcceptInviteDto', AcceptInviteDto]
    ] as const;

    type PasswordDto = ResetPasswordDto | AcceptInviteDto;

    /** A complete, otherwise-valid body with the password fields substituted. */
    function body(password: string, confirmPassword = password) {
        return { token: 'a-one-time-token', password, confirmPassword };
    }

    async function errorsFor(
        Dto: new () => PasswordDto,
        payload: Record<string, unknown>
    ): Promise<ValidationError[]> {
        return validate(plainToInstance(Dto, payload));
    }

    /** The constraint keys that failed, flattened across every field. */
    function constraintKeys(errors: ValidationError[]): string[] {
        return errors.flatMap((error) =>
            Object.keys(error.constraints ?? {}).map(
                (key) => `${error.property}.${key}`
            )
        );
    }

    describe.each(dtos)('%s', (_name, Dto) => {
        describe('the length floor, counted in characters', () => {
            it('rejects a password one character below the minimum', async () => {
                const errors = await errorsFor(Dto, body('a'.repeat(11)));
                expect(constraintKeys(errors)).toEqual(['password.minLength']);
            });

            it('accepts a password exactly at the minimum', async () => {
                const errors = await errorsFor(Dto, body('a'.repeat(12)));
                expect(errors).toEqual([]);
            });
        });

        describe('the length ceiling, counted in bytes', () => {
            it('accepts a password exactly at the byte ceiling', async () => {
                const errors = await errorsFor(Dto, body('a'.repeat(72)));
                expect(errors).toEqual([]);
            });

            it('rejects a password one byte over the ceiling', async () => {
                const errors = await errorsFor(Dto, body('a'.repeat(73)));
                expect(constraintKeys(errors)).toEqual([
                    'password.maxByteLength'
                ]);
            });

            it('accepts 36 two-byte characters, which are exactly 72 bytes', async () => {
                const errors = await errorsFor(Dto, body('é'.repeat(36)));
                expect(errors).toEqual([]);
            });

            it('rejects 37 two-byte characters, which a character count would pass', async () => {
                const errors = await errorsFor(Dto, body('é'.repeat(37)));
                expect(constraintKeys(errors)).toEqual([
                    'password.maxByteLength'
                ]);
            });
        });

        describe('the confirmation', () => {
            it('rejects a confirmation that does not match, on the confirmation field', async () => {
                const errors = await errorsFor(
                    Dto,
                    body('a'.repeat(12), 'b'.repeat(12))
                );
                expect(constraintKeys(errors)).toEqual([
                    'confirmPassword.matchesField'
                ]);
                expect(errors[0].constraints?.['matchesField']).toBe(
                    'confirmPassword must match password'
                );
            });

            it('rejects a missing confirmation', async () => {
                const errors = await errorsFor(Dto, {
                    token: 'a-one-time-token',
                    password: 'a'.repeat(12)
                });
                expect(constraintKeys(errors).sort()).toEqual([
                    'confirmPassword.isString',
                    'confirmPassword.matchesField'
                ]);
            });
        });

        describe('the token', () => {
            it('rejects an empty token', async () => {
                const errors = await validate(
                    plainToInstance(Dto, {
                        token: '',
                        password: 'a'.repeat(12),
                        confirmPassword: 'a'.repeat(12)
                    })
                );
                expect(constraintKeys(errors)).toEqual(['token.isNotEmpty']);
            });
        });
    });
});
