import type { JsonSchema } from './tool';

/** The outcome of checking one tool's arguments against its schema. */
export interface ToolInputValidation {
    /** Whether the arguments satisfy the schema. */
    valid: boolean;
    /** Every problem found, as `path: message`. Empty when {@link valid}. */
    errors: string[];
}

/**
 * Validates a caller's tool arguments against the tool's declared JSON Schema.
 *
 * It lives beside {@link ToolDefinition} because that is the type whose
 * `inputSchema` it interprets. It used to sit in the copilot's framework-free
 * core, where only the copilot's run loop reached it — which is exactly why the
 * MCP endpoint spent its whole life dispatching unvalidated arguments while the
 * copilot refused them. Owned here, {@link ToolRegistry.call} applies it to
 * **every** consumer, and a third one gets it without remembering to ask.
 *
 * **A deliberate subset, not a JSON Schema implementation.** It covers exactly
 * what the generated tool schemas use — `type`, `properties`, `required`,
 * `enum`, `items`, `additionalProperties`, and the numeric/length bounds — and
 * *ignores* keywords it doesn't know (`anyOf`, `oneOf`, `$ref`, `format`,
 * `pattern`) rather than guessing at them. A rule nested inside an `anyOf` is
 * therefore **not** checked at all, which is the one thing a tool author must
 * not read this as promising.
 *
 * That is tolerable because it is a **defence-in-depth** check, not a security
 * boundary: `requires` is what decides whether a tool may run at all, and a
 * handler still owns every rule about its own values. What this stops is a
 * malformed call reaching a handler and turning a caller's mistake into an
 * opaque 500. Every error it produces goes back to the caller as a
 * `validation_failed` tool error naming the field, so a model can fix it and
 * retry.
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
            errors.push(`${path ? `${path}.` : ''}${key}: unexpected property`);
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
