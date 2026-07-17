/**
 * The pure field-value validation rules — the single authority both runtimes
 * apply. `content-server`'s `EntryValidationService` delegates here (it is the
 * gate: nothing is written or published without passing), and `content-admin`
 * renders the same rules client-side as a courtesy. Extracted verbatim from the
 * server's original service so the messages and edge cases are identical.
 *
 * No NestJS, no Drizzle, no `class-validator` — just plain shape/rule checks
 * over a serialized {@link EntryFieldSpec} map and a values bag.
 */

import {
    CONTENT_FIELD_TYPE,
    isEmptyFieldValue
} from '../fields/field-type';
import type { EntryFieldSpec, EntryFieldSpecMap } from '../fields/field-spec';
import type { ValidationIssue, ValidationResult } from './validation-result';

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ISO-8601 calendar date, no time of day. */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * ISO-8601 date-time with a time component (and optional fractional seconds /
 * timezone). Rejects date-only strings, which `Date.parse` would otherwise
 * accept and silently coerce to UTC midnight for a `timestamptz` column.
 */
const DATETIME_RE =
    /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;

/**
 * Compiled-regex cache for field `pattern` rules. Patterns are author-defined
 * and bounded in number, so caching by source avoids recompiling on every
 * validate call without unbounded growth.
 */
const patternCache = new Map<string, RegExp>();
function compiledPattern(pattern: string): RegExp {
    let re = patternCache.get(pattern);
    if (!re) {
        re = new RegExp(pattern);
        patternCache.set(pattern, re);
    }
    return re;
}

/** The shared empty-value test (see {@link isEmptyFieldValue}). */
const isEmpty = isEmptyFieldValue;

/**
 * Validates one value against one serialized field spec, returning the issues
 * it trips (empty for a valid value). Pure — the reusable unit both
 * {@link validateEntryValues} and any per-field caller share.
 */
export function validateFieldValue(
    name: string,
    spec: EntryFieldSpec,
    value: unknown
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const fail = (message: string) => issues.push({ field: name, message });

    // Many/inverse relations are **link-managed**: their links are persisted via
    // the `relations` delta and never travel in the `values` bag, so this bag
    // can't speak to them. Validating them here would flag a *required* one as
    // "is required" on every save (the field is always absent/null), making it
    // unsaveable and unpublishable. Their requiredness is a matter of the link
    // set, not this bag — skip them. Owning **single** relations stay a plain
    // FK id in `values`, so they're still validated below.
    if (
        spec.type === CONTENT_FIELD_TYPE.Relation &&
        (spec.relation?.many || spec.relation?.inverse)
    ) {
        return issues;
    }

    if (isEmpty(value)) {
        if (spec.required) fail('is required');
        return issues; // nothing else to check on an empty value
    }

    const v = spec.validation ?? {};
    switch (spec.type) {
        case CONTENT_FIELD_TYPE.Text:
        case CONTENT_FIELD_TYPE.RichText: {
            if (typeof value !== 'string') {
                fail('must be a string');
                break;
            }
            if (v.minLength !== undefined && value.length < v.minLength)
                fail(`must be at least ${v.minLength} characters`);
            if (v.maxLength !== undefined && value.length > v.maxLength)
                fail(`must be at most ${v.maxLength} characters`);
            if (v.pattern && !compiledPattern(v.pattern).test(value))
                fail(`must match pattern ${v.pattern}`);
            break;
        }
        case CONTENT_FIELD_TYPE.Number:
        case CONTENT_FIELD_TYPE.Money: {
            if (typeof value !== 'number' || Number.isNaN(value)) {
                fail('must be a number');
                break;
            }
            if (v.integer && !Number.isInteger(value))
                fail('must be a whole number');
            if (v.min !== undefined && value < v.min)
                fail(`must be ≥ ${v.min}`);
            if (v.max !== undefined && value > v.max)
                fail(`must be ≤ ${v.max}`);
            break;
        }
        case CONTENT_FIELD_TYPE.Boolean:
            if (typeof value !== 'boolean') fail('must be true or false');
            break;
        case CONTENT_FIELD_TYPE.Date:
            if (typeof value !== 'string' || !DATE_RE.test(value))
                fail('must be an ISO date (YYYY-MM-DD)');
            break;
        case CONTENT_FIELD_TYPE.Datetime:
            if (
                !(value instanceof Date) &&
                (typeof value !== 'string' ||
                    !DATETIME_RE.test(value) ||
                    Number.isNaN(Date.parse(value)))
            )
                fail('must be an ISO date-time');
            break;
        case CONTENT_FIELD_TYPE.Select:
            if (
                typeof value !== 'string' ||
                !(spec.options ?? []).includes(value)
            )
                fail(`must be one of: ${(spec.options ?? []).join(', ')}`);
            break;
        case CONTENT_FIELD_TYPE.Multiselect: {
            const allowed = spec.options ?? [];
            if (
                !Array.isArray(value) ||
                value.some(
                    (item) =>
                        typeof item !== 'string' || !allowed.includes(item)
                )
            )
                fail(`must be a subset of: ${allowed.join(', ')}`);
            break;
        }
        case CONTENT_FIELD_TYPE.Json:
            break; // any JSON value is acceptable
        case CONTENT_FIELD_TYPE.Relation: {
            if (spec.relation?.many) {
                if (
                    !Array.isArray(value) ||
                    value.some(
                        (id) => typeof id !== 'string' || !UUID_RE.test(id)
                    )
                )
                    fail('must be an array of entry ids');
            } else if (typeof value !== 'string' || !UUID_RE.test(value)) {
                fail('must be an entry id');
            }
            break;
        }
    }
    return issues;
}

/** Options for {@link validateEntryValues}. */
export interface ValidateEntryValuesOptions {
    /**
     * Reject keys in `values` that name no field on the type as
     * `unknown field on "<typeName>"`. The server passes `true` (the schema is
     * the contract, not a suggestion) with {@link typeName}; the admin, which
     * only ever renders schema fields, leaves it off.
     */
    rejectUnknownKeys?: boolean;
    /** The content-type name, used only in the unknown-key message. */
    typeName?: string;
}

/**
 * Validates a `values` object against a serialized field-spec map. Unknown keys
 * are reported first (when {@link ValidateEntryValuesOptions.rejectUnknownKeys}
 * is set), then each field's value is checked in schema order — matching the
 * order the server's original service produced.
 */
export function validateEntryValues(
    fields: EntryFieldSpecMap,
    values: Record<string, unknown>,
    options: ValidateEntryValuesOptions = {}
): ValidationResult {
    const issues: ValidationIssue[] = [];

    if (options.rejectUnknownKeys) {
        for (const key of Object.keys(values)) {
            if (!(key in fields))
                issues.push({
                    field: key,
                    message: `unknown field on "${options.typeName ?? ''}"`
                });
        }
    }
    for (const [name, spec] of Object.entries(fields)) {
        issues.push(...validateFieldValue(name, spec, values[name]));
    }

    return { valid: issues.length === 0, issues };
}
