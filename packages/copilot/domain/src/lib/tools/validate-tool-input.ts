import type { JsonSchema } from '../model/model-message';

/** The outcome of checking one tool's arguments against its schema. */
export interface ToolInputValidation {
    /** Whether the arguments satisfy the schema. */
    valid: boolean;
    /** Every problem found, as `path: message`. Empty when {@link valid}. */
    errors: string[];
}

/**
 * Validates a model's tool arguments against the tool's declared JSON Schema.
 *
 * **A deliberate subset, not a JSON Schema implementation.** It covers exactly
 * what the generated tool schemas use — `type`, `properties`, `required`,
 * `enum`, `items`, `additionalProperties`, and the numeric/length bounds — and
 * *ignores* keywords it doesn't know rather than guessing at them. Two reasons
 * to keep it here instead of taking a dependency:
 *
 * - `domain/` imports nothing, which is what makes the tool contracts testable
 *   without a framework. A validator is the last place worth breaking that for.
 * - This is a **defence-in-depth** check, not the security boundary. The
 *   capability profile is what stops a tool being reachable; this stops a
 *   malformed call reaching a tool's `run` and turning a model mistake into a
 *   500. Every error it produces is fed back to the model as a tool error so
 *   the run continues.
 *
 * An unknown keyword being ignored is therefore a bounded failure: the tool's
 * own code still sees the value. Anything stricter belongs in the tool.
 */
export function validateToolInput(
    input: unknown,
    schema: JsonSchema
): ToolInputValidation {
    const errors: string[] = [];
    check(input, schema, '', errors);
    return { valid: errors.length === 0, errors };
}

/** Recursively checks one value against one (sub)schema. */
function check(
    value: unknown,
    schema: JsonSchema,
    path: string,
    errors: string[]
): void {
    const where = path || 'input';
    const type = schema['type'];

    if (typeof type === 'string' && !matchesType(value, type)) {
        errors.push(`${where}: expected ${type}`);
        // Bail out on this branch: every keyword below assumes the type held,
        // and reporting "minLength failed" about a number is noise.
        return;
    }

    const enumValues = schema['enum'];
    if (Array.isArray(enumValues) && !enumValues.includes(value)) {
        errors.push(`${where}: must be one of ${enumValues.join(', ')}`);
    }

    if (type === 'object' || isPlainObject(value)) {
        checkObject(value, schema, path, errors);
    }

    if (Array.isArray(value)) {
        checkArray(value, schema, path, errors);
    }

    if (typeof value === 'string') {
        checkString(value, schema, where, errors);
    }

    if (typeof value === 'number') {
        checkNumber(value, schema, where, errors);
    }
}

/** `required`, `properties`, and `additionalProperties: false`. */
function checkObject(
    value: unknown,
    schema: JsonSchema,
    path: string,
    errors: string[]
): void {
    if (!isPlainObject(value)) {
        return;
    }

    const required = schema['required'];
    if (Array.isArray(required)) {
        for (const key of required) {
            if (typeof key === 'string' && !(key in value)) {
                errors.push(`${path ? `${path}.` : ''}${key}: required`);
            }
        }
    }

    const properties = isPlainObject(schema['properties'])
        ? schema['properties']
        : {};

    for (const [key, raw] of Object.entries(value)) {
        const propertySchema = properties[key];
        if (isPlainObject(propertySchema)) {
            check(raw, propertySchema, path ? `${path}.${key}` : key, errors);
            continue;
        }
        // Only complain about an unknown key when the schema actually closed
        // the object. A schema that stays open is choosing to accept extras.
        if (schema['additionalProperties'] === false) {
            errors.push(
                `${path ? `${path}.` : ''}${key}: unexpected property`
            );
        }
    }
}

/** `items`, `minItems`, `maxItems`. */
function checkArray(
    value: unknown[],
    schema: JsonSchema,
    path: string,
    errors: string[]
): void {
    const where = path || 'input';
    const minItems = schema['minItems'];
    if (typeof minItems === 'number' && value.length < minItems) {
        errors.push(`${where}: expected at least ${minItems} items`);
    }
    const maxItems = schema['maxItems'];
    if (typeof maxItems === 'number' && value.length > maxItems) {
        errors.push(`${where}: expected at most ${maxItems} items`);
    }

    const items = schema['items'];
    if (isPlainObject(items)) {
        value.forEach((entry, index) =>
            check(entry, items, `${path}[${index}]`, errors)
        );
    }
}

/** `minLength`, `maxLength`. */
function checkString(
    value: string,
    schema: JsonSchema,
    where: string,
    errors: string[]
): void {
    const minLength = schema['minLength'];
    if (typeof minLength === 'number' && value.length < minLength) {
        errors.push(`${where}: expected at least ${minLength} characters`);
    }
    const maxLength = schema['maxLength'];
    if (typeof maxLength === 'number' && value.length > maxLength) {
        errors.push(`${where}: expected at most ${maxLength} characters`);
    }
}

/** `minimum`, `maximum`. */
function checkNumber(
    value: number,
    schema: JsonSchema,
    where: string,
    errors: string[]
): void {
    const minimum = schema['minimum'];
    if (typeof minimum === 'number' && value < minimum) {
        errors.push(`${where}: expected >= ${minimum}`);
    }
    const maximum = schema['maximum'];
    if (typeof maximum === 'number' && value > maximum) {
        errors.push(`${where}: expected <= ${maximum}`);
    }
}

/** JSON Schema's type names, mapped onto JavaScript's. */
function matchesType(value: unknown, type: string): boolean {
    switch (type) {
        case 'object':
            return isPlainObject(value);
        case 'array':
            return Array.isArray(value);
        case 'string':
            return typeof value === 'string';
        case 'integer':
            return typeof value === 'number' && Number.isInteger(value);
        case 'number':
            return typeof value === 'number' && Number.isFinite(value);
        case 'boolean':
            return typeof value === 'boolean';
        case 'null':
            return value === null;
        default:
            // An unknown type name is not a failure to report against the
            // value — it's a schema we don't understand. Accept and move on.
            return true;
    }
}

/** A non-null, non-array object — what JSON Schema calls `object`. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
