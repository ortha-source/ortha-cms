import type {
    FilterField,
    FilterGroup,
    FilterRule,
    WithinUnit
} from '@orthacms/query-builder-admin';

/**
 * The query builder's operator ids this module reads, restated as literals.
 *
 * A type-only import keeps this module free of the builder's runtime (React,
 * the design system) so it unit-tests under plain node; the values are pinned
 * to the builder's own `OpId` union by the `satisfies`, so a renamed operator
 * is a compile error here rather than a chip that silently prints nothing.
 */
const OP = {
    IsEmpty: 'is_empty',
    IsNotEmpty: 'is_not_empty',
    Between: 'between',
    WithinLast: 'within_last',
    IsOneOf: 'is_one_of',
    NotOneOf: 'not_one_of'
} as const satisfies Record<string, FilterRule['op']>;

/** `isRule` from the builder, restated for the same reason as {@link OP}. */
const isRule = (node: FilterGroup | FilterRule): node is FilterRule =>
    'fieldId' in node;

/**
 * The pure half of an alarm's condition chips — flattening, removing, and
 * telling which conditions differ from the stored ones.
 *
 * Kept out of the component so it can be unit tested without a DOM, which is
 * this package's convention (component behaviour is pinned in `admin-e2e`).
 */

/** Every leaf condition under a group, nested AND/OR structure dropped. */
export function flattenConditions(group: FilterGroup | null): FilterRule[] {
    if (!group) return [];
    const out: FilterRule[] = [];
    for (const child of group.children) {
        if (isRule(child)) out.push(child);
        else out.push(...flattenConditions(child));
    }
    return out;
}

/**
 * `group` without the condition `ruleId`, or `null` when nothing is left —
 * the same "an empty tree is no tree" convention the editor's `tree` state
 * and the records toolbar both use, so Save's gate reads one shape.
 */
export function removeCondition(
    group: FilterGroup,
    ruleId: string
): FilterGroup | null {
    const prune = (node: FilterGroup): FilterGroup => ({
        ...node,
        children: node.children
            .filter((child) => !(isRule(child) && child.id === ruleId))
            .map((child) => (isRule(child) ? child : prune(child)))
            .filter((child) => isRule(child) || child.children.length > 0)
    });
    const next = prune(group);
    return flattenConditions(next).length > 0 ? next : null;
}

/**
 * What a condition *says*, independent of its client-side id — the ids are
 * minted afresh every time a tree is parsed, so two trees for the same stored
 * filter share no ids at all.
 */
export function conditionSignature(rule: FilterRule): string {
    return JSON.stringify([rule.fieldId, rule.op, rule.value]);
}

/**
 * Ids of the conditions in `current` that the stored condition does not have.
 *
 * Counted as a multiset, so adding a second copy of a stored condition is a
 * change. With no stored condition (a new alarm) every condition is new.
 */
export function changedConditionIds(
    current: FilterGroup | null,
    saved: FilterGroup | null
): Set<string> {
    const remaining = new Map<string, number>();
    for (const rule of flattenConditions(saved)) {
        const key = conditionSignature(rule);
        remaining.set(key, (remaining.get(key) ?? 0) + 1);
    }
    const changed = new Set<string>();
    for (const rule of flattenConditions(current)) {
        const key = conditionSignature(rule);
        const left = remaining.get(key) ?? 0;
        if (left > 0) remaining.set(key, left - 1);
        else changed.add(rule.id);
    }
    return changed;
}

/**
 * The value half of a chip, or `null` when the operator takes none
 * (`is empty`). `label` renders a message descriptor — the enum members are
 * translatable labels, and the wire value is an opaque id nobody can read.
 */
export function conditionValueText(
    field: FilterField | undefined,
    rule: FilterRule,
    label: (descriptor: FilterField['label']) => string
): string | null {
    const member = (value: unknown): string => {
        if (typeof value !== 'string') return '';
        const option = field?.enumValues?.find((opt) => opt.value === value);
        // An unknown member falls back to the raw value rather than
        // disappearing: a chip that showed nothing would read as no condition.
        return option ? label(option.label) : value;
    };

    switch (rule.op) {
        case OP.IsEmpty:
        case OP.IsNotEmpty:
            return null;
        case OP.Between: {
            const v = rule.value as { from?: string; to?: string } | null;
            return `${v?.from ?? ''}–${v?.to ?? ''}`;
        }
        case OP.WithinLast: {
            const v = rule.value as { n?: number; unit?: WithinUnit } | null;
            return `${v?.n ?? ''} ${v?.unit ?? ''}`.trim();
        }
        case OP.IsOneOf:
        case OP.NotOneOf:
            return Array.isArray(rule.value)
                ? rule.value.map(member).join(', ')
                : '';
        default:
            return typeof rule.value === 'string' ? member(rule.value) : '';
    }
}

/**
 * A field's display path — `Author · Name` — or, for a field the surface no
 * longer offers, its id made readable. A broken alarm's condition still has to
 * be identifiable, and the id is the only handle left.
 */
export function conditionFieldText(
    fields: readonly FilterField[],
    fieldId: string,
    label: (descriptor: FilterField['label']) => string
): string {
    const field = fields.find((candidate) => candidate.id === fieldId);
    if (!field) return humanizeFieldId(fieldId);
    return [...(field.group ?? []).map(label), label(field.label)].join(' · ');
}

/**
 * `seoDescription` → `Seo description`, `author.status` → `Author · Status`.
 * Only for a field with no label left to show.
 */
export function humanizeFieldId(fieldId: string): string {
    return fieldId
        .split('.')
        .map((segment) => {
            const words = segment
                .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
                .replace(/[_-]+/g, ' ')
                .trim()
                .toLowerCase();
            return words.charAt(0).toUpperCase() + words.slice(1);
        })
        .join(' · ');
}
