import {
    registerDecorator,
    type ValidationArguments,
    type ValidationOptions
} from 'class-validator';

/**
 * Validates that a string is at most `max` **UTF-8 bytes** long — the sibling
 * of `class-validator`'s `@MaxLength`, which counts UTF-16 code units instead.
 *
 * The two agree on ASCII and diverge on everything else, which matters wherever
 * the real limit is a byte limit. bcrypt truncates its input at 72 bytes, so
 * `@MaxLength(72)` accepts `'é'.repeat(72)` — 72 characters, 144 bytes — and
 * bcrypt then hashes only the first half of the passphrase, silently discarding
 * what the user typed. Counting bytes is what makes the documented rule ("we
 * reject rather than truncate") true.
 *
 * @param max - Inclusive upper bound, in UTF-8 bytes.
 *
 * @example
 * ```typescript
 * class AcceptInviteDto {
 *     \@MaxByteLength(MAX_PASSWORD_LENGTH)
 *     password!: string;
 * }
 * ```
 */
export function MaxByteLength(
    max: number,
    options?: ValidationOptions
): PropertyDecorator {
    return (target: object, propertyName: string | symbol) => {
        registerDecorator({
            name: 'maxByteLength',
            target: target.constructor,
            propertyName: propertyName as string,
            constraints: [max],
            options,
            validator: {
                validate(value: unknown, args: ValidationArguments): boolean {
                    const [limit] = args.constraints as [number];
                    // A non-string fails the sibling `@IsString()`; report it
                    // valid here so one bad type yields one error, not two.
                    if (typeof value !== 'string') {
                        return true;
                    }
                    return Buffer.byteLength(value, 'utf8') <= limit;
                },
                defaultMessage(args: ValidationArguments): string {
                    const [limit] = args.constraints as [number];
                    return `${args.property} must be shorter than or equal to ${limit} bytes`;
                }
            }
        });
    };
}
