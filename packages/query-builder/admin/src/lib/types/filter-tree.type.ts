/**
 * Operator surface exposed in the UI. Maps to the BE wire grammar via
 * the `UI_TO_WIRE` table in `utils/wireOp`.
 *
 * Authored as an `as const` object so call sites read `OP.Equals`
 * instead of the bare string `'equals'` — a rename then surfaces
 * everywhere through TypeScript instead of grep.
 */
export const OP = {
    Equals: 'equals',
    NotEquals: 'not_equals',
    Contains: 'contains',
    NotContains: 'not_contains',
    IsOneOf: 'is_one_of',
    NotOneOf: 'not_one_of',
    IsEmpty: 'is_empty',
    IsNotEmpty: 'is_not_empty',
    Between: 'between',
    Gt: 'gt',
    Gte: 'gte',
    Lt: 'lt',
    Lte: 'lte',
    WithinLast: 'within_last'
} as const;

/** UI operator id — derived from {@link OP} so the union and the const stay in lockstep. */
export type OpId = (typeof OP)[keyof typeof OP];

/** Boolean combinator for a {@link FilterGroup}. */
export const COMBINATOR = {
    And: 'and',
    Or: 'or'
} as const;

/** One of the {@link COMBINATOR} values. */
export type Combinator = (typeof COMBINATOR)[keyof typeof COMBINATOR];

/** Time-window unit for the `within_last` operator. */
export const WITHIN_UNIT = {
    Minutes: 'minutes',
    Hours: 'hours',
    Days: 'days'
} as const;

/** One of the {@link WITHIN_UNIT} values. */
export type WithinUnit = (typeof WITHIN_UNIT)[keyof typeof WITHIN_UNIT];

/** Concrete value shape per operator. Discriminated by `op` at the call site. */
export type RuleValue =
    | string
    | string[]
    | { from: string; to: string }
    | { n: number; unit: WithinUnit }
    | null;

/** Single field/op/value triple. */
export type FilterRule = {
    /** Stable client id for React keys; not serialised. */
    id: string;
    /** Matches a `FilterField.id`. */
    fieldId: string;
    op: OpId;
    /** Shape depends on `op` — see {@link RuleValue}. */
    value: RuleValue;
};

/**
 * Recursive group node. The combinator and `children` shape support OR
 * + nested groups end-to-end (UI → wire → BE).
 */
export type FilterGroup = {
    id: string;
    combinator: Combinator;
    children: (FilterGroup | FilterRule)[];
};

/** Root tree alias — every consumer holds one of these in URL state. */
export type FilterTree = FilterGroup;

/** Type guard distinguishing rules from groups in `FilterGroup.children`. */
export const isRule = (n: FilterGroup | FilterRule): n is FilterRule =>
    'fieldId' in n;
