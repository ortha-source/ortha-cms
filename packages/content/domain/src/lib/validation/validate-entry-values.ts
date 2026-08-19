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
    countCharacters,
    isEmptyFieldValue
} from '../fields/field-type';
import type { EntryFieldSpec, EntryFieldSpecMap } from '../fields/field-spec';
import { isWellFormedLanguageTag } from '../richtext/language-tag';
import {
    isEmptyRichText,
    richTextPlainText
} from '../richtext/rich-text-document';
import { isRichTextDocument } from '../richtext/rich-text-node';
import { inspectRichText } from '../richtext/rich-text-structure';
import type { ValidationIssue, ValidationResult } from './validation-result';
import { compilePattern } from './safe-pattern';

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ISO-8601 calendar date, no time of day — shape only; see {@link isRealDate}. */
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * ISO-8601 date-time with a time component (and optional fractional seconds /
 * timezone). Rejects date-only strings, which `Date.parse` would otherwise
 * accept and silently coerce to UTC midnight for a `timestamptz` column.
 */
const DATETIME_RE =
    /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;

/**
 * Maximum fractional digits a `money` value may carry. The field spec has no
 * currency member, so the kernel enforces the near-universal two minor units
 * rather than guessing a per-currency scale; a three-decimal currency (BHD,
 * KWD, TND) needs a currency-aware rule, which belongs on the spec first.
 */
const MONEY_DECIMAL_PLACES = 2;

/**
 * Days in a month, correct for the proleptic Gregorian leap rule at every year
 * including 0-99 (`setUTCFullYear` avoids `Date.UTC`'s 1900-offset mapping).
 */
function daysInMonth(year: number, month: number): number {
    const probe = new Date(0);
    probe.setUTCFullYear(year, month, 0);
    return probe.getUTCDate();
}

/**
 * Whether a `YYYY-MM-DD` string names a date that exists on the calendar. The
 * shape regex alone accepts `2026-13-45` and `2025-02-30`, which then become a
 * hard error (or a silently rolled-over date) wherever they are finally parsed.
 */
function isRealDate(value: string): boolean {
    const match = DATE_RE.exec(value);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1) return false;
    return day <= daysInMonth(year, month);
}

/**
 * Fractional digits of a finite number, read off its decimal form so that
 * exponent notation (`1e-7`) and float artefacts (`0.1 + 0.2`) are both counted
 * honestly rather than rounded away.
 */
function decimalPlaces(value: number): number {
    const match = /^-?\d+(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(String(value));
    if (!match) return 0;
    const fraction = match[1]?.length ?? 0;
    const exponent = match[2] ? Number(match[2]) : 0;
    return Math.max(0, fraction - exponent);
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

    // A field may declare the language its content is written in (3.1.2). It is
    // a fact about the *field*, not about this value, so it is checked whether
    // or not there is a value to check.
    if (spec.lang !== undefined && !isWellFormedLanguageTag(spec.lang))
        fail(`has an invalid language tag ("${spec.lang}")`);

    // A rich-text body's emptiness is a question about its document, not about
    // its JSON: `{ doc: [paragraph] }` is what an emptied editor leaves behind,
    // and a `required` field cleared by its author has to fail rather than pass
    // on the strength of the wrapper still being there.
    const empty =
        spec.type === CONTENT_FIELD_TYPE.RichText
            ? isEmptyRichText(value)
            : isEmpty(value);
    if (empty) {
        if (spec.required) fail('is required');
        return issues; // nothing else to check on an empty value
    }

    const v = spec.validation ?? {};

    /**
     * The length/pattern rules, over the text a rule is actually about. Shared
     * by `text` (where the value *is* the text) and `richtext` (where it is the
     * body's words, markup excluded).
     */
    const checkText = (text: string) => {
        // Length is counted in **user-perceived characters**, not UTF-16
        // code units: `'👍'.length` is 2 and a family emoji is 11, so a
        // code-unit count spends an author's budget on encoding rather than
        // on text (see {@link countCharacters}).
        const length =
            v.minLength !== undefined || v.maxLength !== undefined
                ? countCharacters(text)
                : 0;
        if (v.minLength !== undefined && length < v.minLength)
            fail(`must be at least ${v.minLength} characters`);
        if (v.maxLength !== undefined && length > v.maxLength)
            fail(`must be at most ${v.maxLength} characters`);
        if (v.pattern) {
            // An author-supplied pattern is untrusted: it may not compile,
            // and it may backtrack exponentially. Both fail the field
            // rather than throwing out of the validator or hanging it.
            const compiled = compilePattern(v.pattern);
            if (compiled.rejected)
                fail(
                    compiled.rejected === 'invalid'
                        ? 'has an invalid pattern rule'
                        : 'has an unsafe pattern rule'
                );
            else if (!compiled.regex.test(text))
                fail(`must match pattern ${v.pattern}`);
        }
    };

    switch (spec.type) {
        case CONTENT_FIELD_TYPE.Text: {
            if (typeof value !== 'string') {
                fail('must be a string');
                break;
            }
            checkText(value);
            break;
        }
        case CONTENT_FIELD_TYPE.RichText: {
            // A body is a **document** — the node tree the editor produces —
            // or, for content written before it was one, the HTML string it
            // was stored as. Both are read as a document below, so every rule
            // is written once; nothing else is a rich-text value at all.
            if (typeof value !== 'string' && !isRichTextDocument(value)) {
                fail('must be a rich-text document');
                break;
            }
            // Counted over the body's words, so `<strong>` costs an author
            // nothing — the markup-counts-as-text problem that made a length
            // rule on rich text mean something different from what it said.
            checkText(richTextPlainText(value));
            // Heading order, table headers, link text and language markers.
            // Only the errors fail the field: a warning is a judgement about
            // phrasing, and the editor is where those belong (it shows the
            // whole list while the author can still act on it).
            if (v.structure !== 'off') {
                for (const issue of inspectRichText(value)) {
                    if (issue.severity === 'error') fail(issue.message);
                }
            }
            break;
        }
        case CONTENT_FIELD_TYPE.Number:
        case CONTENT_FIELD_TYPE.Money: {
            if (typeof value !== 'number' || Number.isNaN(value)) {
                fail('must be a number');
                break;
            }
            // `Infinity` is a `number` that is not `NaN`, and it is never a
            // storable value for a numeric column.
            if (!Number.isFinite(value)) {
                fail('must be a finite number');
                break;
            }
            if (v.integer && !Number.isInteger(value))
                fail('must be a whole number');
            if (v.min !== undefined && value < v.min)
                fail(`must be ≥ ${v.min}`);
            if (v.max !== undefined && value > v.max)
                fail(`must be ≤ ${v.max}`);
            if (
                spec.type === CONTENT_FIELD_TYPE.Money &&
                decimalPlaces(value) > MONEY_DECIMAL_PLACES
            )
                fail(
                    `must have at most ${MONEY_DECIMAL_PLACES} decimal places`
                );
            break;
        }
        case CONTENT_FIELD_TYPE.Boolean:
            if (typeof value !== 'boolean') fail('must be true or false');
            break;
        case CONTENT_FIELD_TYPE.Date:
            if (typeof value !== 'string' || !DATE_RE.test(value))
                fail('must be an ISO date (YYYY-MM-DD)');
            else if (!isRealDate(value)) fail('must be a real calendar date');
            break;
        case CONTENT_FIELD_TYPE.Datetime:
            // A `Date` instance is accepted, but `new Date('nonsense')` is a
            // `Date` whose time is `NaN` — it round-trips to `null`, so it must
            // fail here rather than sail through as a well-typed value.
            if (value instanceof Date) {
                if (Number.isNaN(value.getTime()))
                    fail('must be an ISO date-time');
            } else if (
                typeof value !== 'string' ||
                !DATETIME_RE.test(value) ||
                Number.isNaN(Date.parse(value))
            ) {
                fail('must be an ISO date-time');
            }
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
        case CONTENT_FIELD_TYPE.Relation:
            // Only an **owning single** relation can reach here — a `many` or
            // `inverse` relation is link-managed and returned above, so there
            // is deliberately no array branch in this case.
            if (typeof value !== 'string' || !UUID_RE.test(value))
                fail('must be an entry id');
            break;
        case CONTENT_FIELD_TYPE.Media: {
            // Shape only — an asset id is a uuid (single) or a uuid[] (multiple).
            // Existence in the workspace and the kind/MIME `accept` restriction
            // need the media table, so they're enforced server-side, not here.
            if (spec.multiple) {
                if (
                    !Array.isArray(value) ||
                    value.some(
                        (id) => typeof id !== 'string' || !UUID_RE.test(id)
                    )
                )
                    fail('must be an array of media asset ids');
            } else if (typeof value !== 'string' || !UUID_RE.test(value)) {
                fail('must be a media asset id');
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
            // `Object.hasOwn`, not `key in fields`: `in` walks the prototype
            // chain, so `toString`, `constructor`, `valueOf`, `__proto__` and
            // every other `Object.prototype` member slipped through as "known"
            // while being validated by nothing (the loop below iterates own
            // keys only). Own-key membership is exactly what that loop uses.
            if (!Object.hasOwn(fields, key))
                issues.push({
                    field: key,
                    message: `unknown field on "${options.typeName ?? ''}"`
                });
        }
    }
    for (const [name, spec] of Object.entries(fields)) {
        // Read own properties only, for the mirror-image reason: a field named
        // `toString` (or `constructor`, `valueOf`, …) would otherwise read the
        // inherited `Object.prototype` member as its value, so a *missing*
        // required value looks present and never trips `is required`.
        const value = Object.hasOwn(values, name) ? values[name] : undefined;
        issues.push(...validateFieldValue(name, spec, value));
    }

    return { valid: issues.length === 0, issues };
}
