import { validate } from 'class-validator';
import { MatchesField } from './matches-field.validator';

/**
 * `@MatchesField` — the "confirm your password" rule expressed declaratively.
 *
 * What matters is *where* the failure lands and *what it says*: the error must
 * be attached to the confirmation field (that is the input the person retypes)
 * and its default message must name the sibling it was compared against, so a
 * generic form renderer can explain the mismatch without knowing the rule.
 * Hand-throwing in the controller would give neither.
 */
describe('MatchesField', () => {
    class ConfirmedPassword {
        password!: unknown;

        @MatchesField('password')
        confirmPassword!: unknown;
    }

    function dto(password: unknown, confirmPassword: unknown) {
        const instance = new ConfirmedPassword();
        instance.password = password;
        instance.confirmPassword = confirmPassword;
        return instance;
    }

    describe('agreement', () => {
        it('accepts a confirmation identical to the field it mirrors', async () => {
            const errors = await validate(
                dto('correct horse battery', 'correct horse battery')
            );
            expect(errors).toEqual([]);
        });

        it.each([
            ['a different value', 'a-password', 'another-password'],
            ['a case difference', 'Password-Long', 'password-long'],
            ['trailing whitespace', 'a-password', 'a-password '],
            ['an empty confirmation', 'a-password', ''],
            ['a missing confirmation', 'a-password', undefined]
        ])('rejects %s', async (_label, password, confirmation) => {
            const errors = await validate(dto(password, confirmation));
            expect(errors).toHaveLength(1);
            expect(errors[0].constraints).toHaveProperty('matchesField');
        });
    });

    describe('where the error lands', () => {
        it('attaches the error to the confirmation field, not the original', async () => {
            const errors = await validate(dto('a-password', 'b-password'));
            expect(errors.map((error) => error.property)).toEqual([
                'confirmPassword'
            ]);
        });
    });

    describe('defaultMessage', () => {
        it('names both the property and the sibling it must equal', async () => {
            const errors = await validate(dto('a-password', 'b-password'));
            expect(errors[0].constraints?.['matchesField']).toBe(
                'confirmPassword must match password'
            );
        });
    });
});
