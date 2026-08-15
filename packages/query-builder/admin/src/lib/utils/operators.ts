import { defineMessages, type MessageDescriptor } from 'react-intl';
import { FIELD_TYPE, type FieldType } from '../types/filter-field.type';
import { OP, type OpId } from '../types/filter-tree.type';

/** Operators allowed per field type. The picker filters its options against this. */
export const OPS_FOR_TYPE: Record<FieldType, readonly OpId[]> = {
    [FIELD_TYPE.String]: [
        OP.Equals,
        OP.NotEquals,
        OP.Contains,
        OP.NotContains,
        OP.IsOneOf,
        OP.NotOneOf,
        OP.IsEmpty,
        OP.IsNotEmpty
    ],
    [FIELD_TYPE.Number]: [
        OP.Equals,
        OP.NotEquals,
        OP.Gt,
        OP.Gte,
        OP.Lt,
        OP.Lte,
        OP.Between,
        OP.IsEmpty,
        OP.IsNotEmpty
    ],
    [FIELD_TYPE.Boolean]: [OP.Equals],
    [FIELD_TYPE.Uuid]: [
        OP.Equals,
        OP.NotEquals,
        OP.IsOneOf,
        OP.NotOneOf,
        OP.IsEmpty,
        OP.IsNotEmpty
    ],
    // No `equals` for dates: the editor is minute-precision (`datetime-local`)
    // while the column is a millisecond `timestamptz`, so `eq` would compare
    // against an instant at `:00` seconds and essentially never match a real
    // row — a dead-end filter. Ranges (`between`, gt/gte/lt/lte, `within_last`)
    // stay, since they bound rather than pin the instant.
    [FIELD_TYPE.Date]: [
        OP.Gt,
        OP.Gte,
        OP.Lt,
        OP.Lte,
        OP.Between,
        OP.WithinLast,
        OP.IsEmpty,
        OP.IsNotEmpty
    ],
    [FIELD_TYPE.Enum]: [
        OP.Equals,
        OP.NotEquals,
        OP.IsOneOf,
        OP.NotOneOf,
        OP.IsEmpty,
        OP.IsNotEmpty
    ]
} as const;

/**
 * The operators a field offers: its own {@link FilterField.operators} narrowing
 * when it declares one, else everything its type allows.
 *
 * A field type describes value *shape*, not what the backend can answer about
 * it — a virtual field resolved by a subquery may be enum-shaped and still
 * support only a couple of operators. Resolving both here keeps the picker and
 * the field-change reset from drifting apart.
 */
export function opsForField(field: {
    type: FieldType;
    operators?: readonly OpId[];
}): readonly OpId[] {
    const allowed = OPS_FOR_TYPE[field.type];
    if (!field.operators) return allowed;
    const narrowed = allowed.filter((op) => field.operators?.includes(op));
    // A narrowing that matches nothing is a config error; falling back beats
    // rendering an operator picker with no options at all.
    return narrowed.length > 0 ? narrowed : allowed;
}

/**
 * Localised label for one operator — display only, never serialised.
 * Components resolve via `intl.formatMessage(OP_LABELS[op])`.
 *
 * Keyed by the literal `OpId` strings (not `[OP.Equals]`) so the
 * FormatJS extractor — which only walks AST literals — can pick these
 * up. The `OP` const values are identical to these keys, so the
 * `OP_LABELS[OP.Equals]` lookup still works.
 */
export const OP_LABELS = defineMessages({
    equals: { id: 'qb.op.equals', defaultMessage: 'equals' },
    not_equals: { id: 'qb.op.notEquals', defaultMessage: 'is not' },
    contains: { id: 'qb.op.contains', defaultMessage: 'contains' },
    not_contains: {
        id: 'qb.op.notContains',
        defaultMessage: 'does not contain'
    },
    is_one_of: { id: 'qb.op.isOneOf', defaultMessage: 'is one of' },
    not_one_of: { id: 'qb.op.notOneOf', defaultMessage: 'is none of' },
    is_empty: { id: 'qb.op.isEmpty', defaultMessage: 'is empty' },
    is_not_empty: { id: 'qb.op.isNotEmpty', defaultMessage: 'is not empty' },
    between: { id: 'qb.op.between', defaultMessage: 'between' },
    gt: { id: 'qb.op.gt', defaultMessage: 'greater than' },
    gte: {
        id: 'qb.op.gte',
        defaultMessage: 'greater than or equal to'
    },
    lt: { id: 'qb.op.lt', defaultMessage: 'less than' },
    lte: { id: 'qb.op.lte', defaultMessage: 'less than or equal to' },
    within_last: {
        id: 'qb.op.withinLast',
        defaultMessage: 'within the last'
    }
}) as Record<OpId, MessageDescriptor>;
