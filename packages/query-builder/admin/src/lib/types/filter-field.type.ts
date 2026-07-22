import type { ReactNode } from 'react';
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
    /**
     * Wire field name. With relation filtering this is a **dotted path**
     * (`author.name`) walked segment-by-segment against the BE schema; for a
     * flat column it is the bare field name. Matches a leaf the BE
     * `FilterSchema` whitelists.
     */
    id: string;
    /** Intl message rendered in the field picker — never serialised. */
    label: MessageDescriptor;
    type: FieldType;
    /** Required when `type === FIELD_TYPE.Enum`. Drives both `is_one_of` and the value editor. */
    enumValues?: readonly FilterEnumValue[];
    /**
     * Breadcrumb of relation labels, root-first — `['Author']` for
     * `author.name`. Empty or absent for a root field. Groups the field
     * picker; never serialised. A consumer that declares no relations (the
     * flat case) omits it and its fields land in the ungrouped root section.
     */
    group?: readonly MessageDescriptor[];
    /**
     * Target content-type name for a relation's `id` field. When set, the
     * consumer's `renderRelationValue` renders a record picker instead of the
     * raw uuid input. `author.id` → `'author'`.
     */
    relationTarget?: string;
};

/**
 * Props a consumer-supplied relation value editor receives — the editor for
 * a rule whose field carries a `relationTarget`. `value` is always an id
 * array (a single-valued op passes at most one); `onChange` returns the new
 * id set, which the query builder narrows back to the op's shape.
 */
export type RelationValueEditorProps = {
    /** {@link FilterField.relationTarget} — the content type to pick from. */
    target: string;
    /** Currently selected target ids. */
    value: readonly string[];
    onChange: (next: string[]) => void;
    disabled?: boolean;
    /** Marks the control `aria-invalid` when the rule fails validation. */
    invalid?: boolean;
    /** Id of the rule's error message, wired as `aria-describedby`. */
    describedById?: string;
};

/**
 * Renders the value editor for a relation-id rule. Injected into
 * {@link QueryBuilder} because this package holds no data layer — the
 * consumer owns fetching the candidate records. Omit it and such rules fall
 * back to the raw uuid input.
 */
export type RelationValueEditor = (props: RelationValueEditorProps) => ReactNode;
