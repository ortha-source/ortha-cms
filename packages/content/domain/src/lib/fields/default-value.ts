/**
 * A field's **default value** — what the entry editor's create form starts the
 * field at. It is a *prefill*, not a column `DEFAULT`: nothing in the database
 * changes, an existing entry keeps what it holds, and an entry written through
 * the API without the field stays without it. The editor seeds a blank form
 * with it and the author's typing owns it from then on.
 *
 * Only a value that means the same thing in every environment can be a
 * default, so it is offered on the scalar types and the two choice types. A
 * relation or a media field would name a row by its id, which is data, not
 * code: it differs between a development database and production, may not be
 * readable in a workspace, and can be deleted out from under the schema.
 */

import { CONTENT_FIELD_TYPE, isEmptyFieldValue } from './field-type';
import type { EntryFieldSpec } from './field-spec';
import { validateFieldValue } from '../validation/validate-entry-values';

/** The field types that take a `defaultValue`. */
export const DEFAULT_VALUE_FIELD_TYPES: readonly string[] = [
    CONTENT_FIELD_TYPE.Text,
    CONTENT_FIELD_TYPE.Number,
    CONTENT_FIELD_TYPE.Money,
    CONTENT_FIELD_TYPE.Boolean,
    CONTENT_FIELD_TYPE.Date,
    CONTENT_FIELD_TYPE.Datetime,
    CONTENT_FIELD_TYPE.Select,
    CONTENT_FIELD_TYPE.Multiselect
];

/**
 * The relative defaults: a `date` field may default to the day the form is
 * opened, a `datetime` field to the minute. Resolved by the editor when it
 * seeds the form, so the value is the author's "now", not the schema's.
 */
export const DEFAULT_TODAY = 'today';
export const DEFAULT_NOW = 'now';

/** Whether a field of this type takes a `defaultValue`. */
export const takesDefaultValue = (type: string): boolean =>
    DEFAULT_VALUE_FIELD_TYPES.includes(type);

/** Whether `value` is the relative default of a field of this type. */
export const isRelativeDefault = (type: string, value: unknown): boolean =>
    (type === CONTENT_FIELD_TYPE.Date && value === DEFAULT_TODAY) ||
    (type === CONTENT_FIELD_TYPE.Datetime && value === DEFAULT_NOW);

/**
 * Why `value` cannot be this field's default — phrased to follow "which", as
 * in `default value 7, which must be ≤ 5` — or `undefined` when it can.
 *
 * A default is a value the field would accept: it goes through the same
 * validator as an entry's value, so a default outside the options, the range
 * or the pattern is caught when the schema is written, not on the first save.
 */
export function defaultValueProblem(
    spec: EntryFieldSpec,
    value: unknown
): string | undefined {
    if (!takesDefaultValue(spec.type))
        return `cannot be used: a ${spec.type} field takes no default value`;
    if (isRelativeDefault(spec.type, value)) return undefined;
    if (isEmptyFieldValue(value))
        return 'is empty — leave the default out instead';
    const [first] = validateFieldValue(
        'defaultValue',
        { ...spec, required: false },
        value
    );
    return first?.message;
}
