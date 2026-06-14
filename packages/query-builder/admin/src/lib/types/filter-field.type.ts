import type { MessageDescriptor } from 'react-intl';

/**
 * Coercion type for one filterable column. Drives operator and
 * value-editor selection. Authored as an `as const` object so consumers
 * say `FIELD_TYPE.String` instead of the bare `'string'`.
 */
export const FIELD_TYPE = {
    String: 'string',
    Number: 'number',
    Boolean: 'boolean',
    Uuid: 'uuid',
    Date: 'date',
    Enum: 'enum'
} as const;

/** Field-type id derived from {@link FIELD_TYPE}. */
export type FieldType = (typeof FIELD_TYPE)[keyof typeof FIELD_TYPE];

/**
 * Localised enum option pair — `value` goes on the wire, `label` is the
 * intl message rendered in the picker.
 */
export type FilterEnumValue = { value: string; label: MessageDescriptor };

/** One filterable column declared by a consumer. Mirrors a key in the BE FilterSchema. */
export type FilterField = {
    /** Wire field name; matches a key in the BE FilterSchema.fields. */
    id: string;
    /** Intl message rendered in the field picker — never serialised. */
    label: MessageDescriptor;
    type: FieldType;
    /** Required when `type === FIELD_TYPE.Enum`. Drives both `is_one_of` and the value editor. */
    enumValues?: readonly FilterEnumValue[];
};
