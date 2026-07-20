import { defineMessages, useIntl, type IntlShape } from 'react-intl';
import { X } from 'lucide-react';
import { cn } from '@ortha-cms/design-system';
import type { FilterField } from '../../types/filter-field.type';
import {
    isRule,
    OP,
    type FilterGroup,
    type FilterRule,
    type WithinUnit
} from '../../types/filter-tree.type';
import { countRules } from '../../utils/countRules';
import { OP_LABELS } from '../../utils/operators';
import { removeNode } from '../../utils/treeOps';

const messages = defineMessages({
    remove: {
        id: 'qb.summary.remove',
        defaultMessage: 'Remove condition {label}'
    },
    clearAll: { id: 'qb.summary.clearAll', defaultMessage: 'Clear all' }
});

/** Props for {@link QueryBuilderSummary}. */
export type QueryBuilderSummaryProps = {
    /** The applied filter tree. Render this only when it holds rules. */
    tree: FilterGroup;
    /** Field definitions, for resolving a rule's label. */
    fields: readonly FilterField[];
    /** Commit a narrowed tree (a chip removed) or `null` (all cleared). */
    onChange: (next: FilterGroup | null) => void;
    className?: string;
};

/** Every leaf rule under a group, flattened (nested AND/OR structure dropped). */
function flattenRules(group: FilterGroup): FilterRule[] {
    const out: FilterRule[] = [];
    for (const child of group.children) {
        if (isRule(child)) out.push(child);
        else out.push(...flattenRules(child));
    }
    return out;
}

/** The value half of a chip's label, or `null` when the operator needs none. */
function formatValue(rule: FilterRule, intl: IntlShape): string | null {
    switch (rule.op) {
        case OP.IsEmpty:
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
            return Array.isArray(rule.value) ? rule.value.join(', ') : '';
        default:
            return typeof rule.value === 'string' ? rule.value : '';
    }
}

/**
 * The resting summary of an applied filter, shown under the toolbar while the
 * builder panel is collapsed: one removable chip per condition
 * ("Author · Email contains @lilly ×") plus a "Clear all" action. Removing a
 * chip re-commits the narrowed tree immediately, so the table re-runs at once.
 * Nested AND/OR structure is flattened here — the panel is where structure is
 * edited; this is a compact read-out.
 */
export function QueryBuilderSummary({
    tree,
    fields,
    onChange,
    className
}: QueryBuilderSummaryProps) {
    const intl = useIntl();
    const rules = flattenRules(tree);
    if (rules.length === 0) return null;

    const remove = (ruleId: string) => {
        const next = removeNode(tree, ruleId);
        onChange(countRules(next) > 0 ? next : null);
    };

    return (
        <div className={cn('flex flex-wrap items-center gap-2', className)}>
            {rules.map((rule) => {
                const field = fields.find((f) => f.id === rule.fieldId);
                const crumbs = (field?.group ?? []).map((g) =>
                    intl.formatMessage(g)
                );
                const leaf = field
                    ? intl.formatMessage(field.label)
                    : rule.fieldId;
                const path = [...crumbs, leaf].join(' · ');
                const op = intl.formatMessage(OP_LABELS[rule.op]);
                const value = formatValue(rule, intl);

                return (
                    <span
                        key={rule.id}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-xl border bg-card px-2.5 py-1 text-xs"
                    >
                        <span className="truncate">
                            <span className="font-medium text-foreground">
                                {path}
                            </span>{' '}
                            <span className="text-muted-foreground">{op}</span>
                            {value ? (
                                <>
                                    {' '}
                                    <span className="font-medium text-foreground">
                                        {value}
                                    </span>
                                </>
                            ) : null}
                        </span>
                        <button
                            type="button"
                            aria-label={intl.formatMessage(messages.remove, {
                                label: `${path} ${op}`.trim()
                            })}
                            onClick={() => remove(rule.id)}
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                        >
                            <X aria-hidden className="size-3.5" />
                        </button>
                    </span>
                );
            })}
            <button
                type="button"
                onClick={() => onChange(null)}
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
                {intl.formatMessage(messages.clearAll)}
            </button>
        </div>
    );
}
