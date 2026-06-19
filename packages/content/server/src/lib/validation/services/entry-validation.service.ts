/**
 * Server-side validation of entry values against a content type's field
 * specs. The single authority — the admin renders the same rules
 * client-side as a courtesy, but nothing publishes without passing here.
 */

import { Injectable } from '@nestjs/common';
import type { AnyContentType } from '../../types/content-type';
import type { AnyFieldSpec } from '../../types/fields';

/** One failed rule on one field. */
export interface ValidationIssue {
    field: string;
    message: string;
}

/** Result of validating a values object. */
export interface ValidationResult {
    valid: boolean;
    issues: ValidationIssue[];
}

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
 * `validate()` call without unbounded growth.
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

function isEmpty(value: unknown): boolean {
    return (
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0)
    );
}

/** Validates one value against one field spec. */
function checkField(
    name: string,
    spec: AnyFieldSpec,
    value: unknown
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const fail = (message: string) => issues.push({ field: name, message });

    if (isEmpty(value)) {
        if (spec.required) fail('is required');
        return issues; // nothing else to check on an empty value
    }

    const v = spec.validation;
    switch (spec.type) {
        case 'text':
        case 'richtext': {
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
        case 'number':
        case 'money': {
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
        case 'boolean':
            if (typeof value !== 'boolean') fail('must be true or false');
            break;
        case 'date':
            if (typeof value !== 'string' || !DATE_RE.test(value))
                fail('must be an ISO date (YYYY-MM-DD)');
            break;
        case 'datetime':
            if (
                !(value instanceof Date) &&
                (typeof value !== 'string' ||
                    !DATETIME_RE.test(value) ||
                    Number.isNaN(Date.parse(value)))
            )
                fail('must be an ISO date-time');
            break;
        case 'select':
            if (
                typeof value !== 'string' ||
                !(spec.options ?? []).includes(value)
            )
                fail(`must be one of: ${(spec.options ?? []).join(', ')}`);
            break;
        case 'media':
            if (typeof value !== 'string') fail('must be an asset id');
            break;
        case 'json':
            break; // any JSON value is acceptable
        case 'relation': {
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

@Injectable()
export class EntryValidationService {
    /**
     * Validates a values object against a content type. Unknown keys are
     * rejected — the schema is the contract, not a suggestion.
     */
    validate(
        type: AnyContentType,
        values: Record<string, unknown>
    ): ValidationResult {
        const issues: ValidationIssue[] = [];

        for (const key of Object.keys(values)) {
            if (!(key in type.fields))
                issues.push({
                    field: key,
                    message: `unknown field on "${type.name}"`
                });
        }
        for (const [name, spec] of Object.entries(type.fields)) {
            issues.push(...checkField(name, spec, values[name]));
        }

        return { valid: issues.length === 0, issues };
    }
}
