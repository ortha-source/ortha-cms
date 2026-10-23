import {
    COMBINATOR,
    OP,
    isRule,
    type FilterGroup,
    type FilterRule
} from '@orthacms/query-builder-admin';

/**
 * The records toolbar's three status chips. Each one is a pair of ordinary
 * filter conditions, so it lands in `?filter=`, reads out in the applied-filter
 * chips, saves into a view and round-trips a link like any filter the builder
 * writes — there is no second filter channel to keep in step.
 */
export const QUICK_STATUS = {
    Published: 'published',
    Modified: 'modified',
    Draft: 'draft'
} as const;

/** One of the {@link QUICK_STATUS} values. */
export type QuickStatus = (typeof QUICK_STATUS)[keyof typeof QUICK_STATUS];

/** The stored status column — publishable types only. */
export const STATUS_FIELD = 'status';
/**
 * Stamped on publish, cleared only by unpublish: what tells a **Modified**
 * record (draft, live content behind it) from a never-published **Draft**.
 */
export const PUBLISHED_AT_FIELD = 'publishedAt';

const OWN_FIELDS = new Set([STATUS_FIELD, PUBLISHED_AT_FIELD]);

type RuleShape = Pick<FilterRule, 'fieldId' | 'op' | 'value'>;

/** The conditions each chip stands for. */
export function quickStatusRules(status: QuickStatus): RuleShape[] {
    switch (status) {
        case QUICK_STATUS.Published:
            return [
                { fieldId: STATUS_FIELD, op: OP.Equals, value: 'published' }
            ];
        case QUICK_STATUS.Modified:
            return [
                { fieldId: STATUS_FIELD, op: OP.Equals, value: 'draft' },
                { fieldId: PUBLISHED_AT_FIELD, op: OP.IsNotEmpty, value: null }
            ];
        case QUICK_STATUS.Draft:
            return [
                { fieldId: STATUS_FIELD, op: OP.Equals, value: 'draft' },
                { fieldId: PUBLISHED_AT_FIELD, op: OP.IsEmpty, value: null }
            ];
    }
}

const sameRule = (a: RuleShape, b: RuleShape) =>
    a.fieldId === b.fieldId && a.op === b.op && a.value === b.value;

/** The root-level conditions on the two fields the chips own. */
function ownRules(tree: FilterGroup | null): FilterRule[] {
    if (!tree || tree.combinator !== COMBINATOR.And) return [];
    return tree.children.filter(
        (node): node is FilterRule =>
            isRule(node) && OWN_FIELDS.has(node.fieldId)
    );
}

/**
 * Which chip the applied filter matches, if any: exactly that chip's
 * conditions on `status` / `publishedAt` at the root of an AND tree, whatever
 * else the tree holds beside them.
 */
export function activeQuickStatus(
    tree: FilterGroup | null
): QuickStatus | null {
    const own = ownRules(tree);
    for (const status of Object.values(QUICK_STATUS)) {
        const wanted = quickStatusRules(status);
        if (
            own.length === wanted.length &&
            wanted.every((rule) => own.some((have) => sameRule(have, rule)))
        ) {
            return status;
        }
    }
    return null;
}

/**
 * The applied filter with its status narrowed to `status` (or cleared, for
 * `null`), every other condition kept. A root OR group is kept whole, as one
 * child of a new AND — its own `status` conditions are not the chips' to
 * remove.
 */
export function withQuickStatus(
    tree: FilterGroup | null,
    status: QuickStatus | null,
    newId: () => string
): FilterGroup | null {
    const rules: FilterRule[] = status
        ? quickStatusRules(status).map((rule) => ({ ...rule, id: newId() }))
        : [];
    let rest: FilterGroup['children'] = [];
    if (tree && tree.combinator === COMBINATOR.And) {
        rest = tree.children.filter(
            (node) => !(isRule(node) && OWN_FIELDS.has(node.fieldId))
        );
    } else if (tree && tree.children.length > 0) {
        rest = [tree];
    }
    const children = [...rest, ...rules];
    if (children.length === 0) return null;
    return {
        id: tree?.combinator === COMBINATOR.And ? tree.id : newId(),
        combinator: COMBINATOR.And,
        children
    };
}
