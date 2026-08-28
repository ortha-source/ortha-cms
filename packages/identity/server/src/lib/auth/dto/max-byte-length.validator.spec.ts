import { IsString, validate } from 'class-validator';
import { MaxByteLength } from './max-byte-length.validator';

/**
 * `@MaxByteLength` — the byte-counted ceiling the password DTOs use instead of
 * `class-validator`'s character-counted `@MaxLength`.
 *
 * Two properties are worth pinning down and neither is the happy path:
 *
 * - it **abstains on non-strings**, returning `true` so a number or a `null`
 *   produces the one `isString` error it deserves rather than two errors
 *   describing the same mistake;
 * - its `defaultMessage` names the field and states the limit **in bytes**,
 *   because a message reading "shorter than or equal to 72" next to a
 *   72-character passphrase that was rejected is a support ticket.
 *
 * Driven through `validate()` on real decorated classes rather than by calling
 * the validator object directly — the registration is half of what is being
 * tested.
 */
describe('MaxByteLength', () => {
    /** A DTO carrying only the byte bound, so nothing else can raise an error. */
    class ByteBoundOnly {
        @MaxByteLength(72)
        password!: unknown;
    }

    /** The realistic pairing: the type check the DTOs put beside the bound. */
    class TypedByteBound {
        @IsString()
        @MaxByteLength(72)
        password!: unknown;
    }

    function withPassword<T extends object>(
        Dto: new () => T,
        password: unknown
    ): T {
        const dto = new Dto();
        (dto as { password: unknown }).password = password;
        return dto;
    }

    describe('byte counting', () => {
        it('accepts a value exactly at the byte limit', async () => {
            const errors = await validate(
                withPassword(ByteBoundOnly, 'a'.repeat(72))
            );
            expect(errors).toEqual([]);
        });

        it('rejects a value one byte over the limit', async () => {
            const errors = await validate(
                withPassword(ByteBoundOnly, 'a'.repeat(73))
            );
            expect(errors).toHaveLength(1);
            expect(errors[0].constraints).toHaveProperty('maxByteLength');
        });

        it('rejects 72 multi-byte characters, which `@MaxLength` would pass', async () => {
            // 72 characters, 144 UTF-8 bytes — the case the decorator exists for.
            const errors = await validate(
                withPassword(ByteBoundOnly, 'é'.repeat(72))
            );
            expect(errors).toHaveLength(1);
            expect(errors[0].constraints).toHaveProperty('maxByteLength');
        });
    });

    describe('abstaining on non-strings', () => {
        it.each([
            ['a number', 42],
            ['null', null],
            ['undefined', undefined],
            ['an object', { toString: () => 'a'.repeat(200) }],
            ['an array', ['a'.repeat(200)]]
        ])(
            'reports %s as valid, leaving the type check to say so',
            async (_label, value) => {
                const errors = await validate(
                    withPassword(ByteBoundOnly, value)
                );
                expect(errors).toEqual([]);
            }
        );

        it.each([
            ['a number', 42],
            ['null', null]
        ])('yields one error, not two, for %s', async (_label, value) => {
            const errors = await validate(withPassword(TypedByteBound, value));
            expect(errors).toHaveLength(1);
            expect(Object.keys(errors[0].constraints ?? {})).toEqual([
                'isString'
            ]);
        });
    });

    describe('defaultMessage', () => {
        it('names the property and states the limit in bytes', async () => {
            const errors = await validate(
                withPassword(ByteBoundOnly, 'a'.repeat(73))
            );
            expect(errors[0].constraints?.['maxByteLength']).toBe(
                'password must be shorter than or equal to 72 bytes'
            );
        });

        it('reports the limit the decorator was given, not a fixed 72', async () => {
            class ShortBound {
                @MaxByteLength(8)
                nickname!: string;
            }

            const dto = new ShortBound();
            dto.nickname = 'a'.repeat(9);

            const errors = await validate(dto);
            expect(errors[0].constraints?.['maxByteLength']).toBe(
                'nickname must be shorter than or equal to 8 bytes'
            );
        });
    });
});
