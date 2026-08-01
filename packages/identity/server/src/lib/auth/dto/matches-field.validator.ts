import {
    registerDecorator,
    type ValidationArguments,
    type ValidationOptions
} from 'class-validator';

/**
 * Validates that a property equals another property of the same DTO — the
 * "confirm your password" rule, expressed declaratively so the mismatch comes
 * back through the global `ValidationPipe` as a normal field error rather than
 * a hand-thrown exception in the controller.
 *
 * @param property - Name of the sibling property this one must equal.
 *
 * @example
 * ```typescript
 * class AcceptInviteDto {
 *     password!: string;
 *
 *     \@MatchesField('password', { message: 'Passwords do not match' })
 *     confirmPassword!: string;
 * }
 * ```
 */
export function MatchesField(
    property: string,
    options?: ValidationOptions
): PropertyDecorator {
    return (target: object, propertyName: string | symbol) => {
        registerDecorator({
            name: 'matchesField',
            target: target.constructor,
            propertyName: propertyName as string,
            constraints: [property],
            options,
            validator: {
                validate(value: unknown, args: ValidationArguments): boolean {
                    const [sibling] = args.constraints as [string];
                    return (
                        value ===
                        (args.object as Record<string, unknown>)[sibling]
                    );
                },
                defaultMessage(args: ValidationArguments): string {
                    const [sibling] = args.constraints as [string];
                    return `${args.property} must match ${sibling}`;
                }
            }
        });
    };
}
