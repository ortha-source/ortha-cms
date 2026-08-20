import { defineMessages, useIntl } from 'react-intl';
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
import { fieldPath } from '../../utils/fieldPath';

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
function formatValue(rule: FilterRule): string | null {
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
                // The same composition the builder's rows now use for their
                // control names — one implementation, so a chip and the row it
                // came from cannot drift into two names for one rule.
                const path = fieldPath(intl, fields, rule.fieldId);
                const op = intl.formatMessage(OP_LABELS[rule.op]);
                const value = formatValue(rule);

                return (
                    <span
                        key={rule.id}
                        title={`${path} ${op}${value ? ` ${value}` : ''}`}
                        className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-xl border bg-card px-2.5 py-1 text-xs"
                    >
                        <span className="min-w-0 truncate">
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
                            data-qb-chip-remove
                            onClick={(event) => {
                                // Hand focus on before the chip unmounts with
                                // it, or focus falls to `<body>` and the next
                                // Tab restarts at the top of the document —
                                // the same defect as the builder's own remove
                                // buttons (2.4.3, `ORT-157`). Prefers the next
                                // chip, then the previous; the remaining chips
                                // keep their DOM nodes across the re-render
                                // because the list is keyed.
                                focusAfterChipRemoval(event.currentTarget);
                                remove(rule.id);
                            }}
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

/**
 * Moves focus off a chip's remove button before the chip goes.
 *
 * Walks the chip row for the next remove button, then the previous. When the
 * last chip is removed the whole summary unmounts and there is nothing here to
 * land on — the consumer's own "clear filters" control is what remains, and
 * naming a target across that boundary would couple this to every host.
 */
function focusAfterChipRemoval(trigger: HTMLElement): void {
    const row = trigger.closest('div');
    if (!row) return;

    const removes = Array.from(
        row.querySelectorAll<HTMLElement>('[data-qb-chip-remove]')
    );
    const position = removes.indexOf(trigger);
    const target =
        (position >= 0 ? removes[position + 1] : undefined) ??
        (position > 0 ? removes[position - 1] : undefined);

    if (!target) return;
    requestAnimationFrame(() => target.focus());
}
