import { defineMessages, useIntl } from 'react-intl';
import { X } from 'lucide-react';
import { cn } from '@orthacms/design-system';
import {
    OP_LABELS,
    type FilterField,
    type FilterGroup
} from '@orthacms/query-builder-admin';
import {
    conditionFieldText,
    conditionValueText,
    flattenConditions
} from '../../../utils/conditions';

const messages = defineMessages({
    label: { id: 'alarms.chips.label', defaultMessage: 'Conditions' },
    remove: {
        id: 'alarms.chips.remove',
        defaultMessage: 'Remove condition {label}'
    },
    suspect: {
        id: 'alarms.chips.suspect',
        defaultMessage: '(changed — check this one)'
    }
});

/** Props for {@link ConditionChips}. */
export type ConditionChipsProps = {
    /** The condition tree. Renders nothing when it holds no condition. */
    tree: FilterGroup | null;
    /** The type's filterable surface, for resolving labels. */
    fields: readonly FilterField[];
    /**
     * Remove one condition. Present → each chip carries a remove button;
     * absent → the chips are a read-out (the alarm cards).
     */
    onRemove?: (ruleId: string) => void;
    /**
     * Called when the last chip's remove button is used, so the caller can
     * put focus somewhere that still exists (the "Condition" button) — the
     * whole list unmounts with it.
     */
    onEmptied?: () => void;
    /**
     * Conditions to draw in the destructive tone — on the editor, the ones
     * that differ from the stored alarm while the preview says the condition
     * is probably inverted, i.e. the likely culprits.
     */
    suspectIds?: ReadonlySet<string>;
    className?: string;
};

/**
 * An alarm's conditions as chips — "SEO description *is* empty" — the same
 * read-out the records list's filter toolbar gives, so a condition reads the
 * same wherever it is shown.
 *
 * Its own component rather than the query builder's `QueryBuilderSummary`
 * because the alarms surfaces need two things that one does not do: a
 * read-only mode for the alarm cards (a chip there cannot be removed) and a
 * per-chip tone for the editor's inverted-condition hint. Nested AND/OR
 * structure is flattened here, exactly as there; the builder is where
 * structure is edited.
 */
export function ConditionChips({
    tree,
    fields,
    onRemove,
    onEmptied,
    suspectIds,
    className
}: ConditionChipsProps) {
    const intl = useIntl();
    const rules = flattenConditions(tree);
    if (rules.length === 0) return null;
    const label = (descriptor: FilterField['label']) =>
        intl.formatMessage(descriptor);

    return (
        <ul
            aria-label={intl.formatMessage(messages.label)}
            className={cn('flex flex-wrap items-center gap-1.5', className)}
        >
            {rules.map((rule) => {
                const path = conditionFieldText(fields, rule.fieldId, label);
                const op = intl.formatMessage(OP_LABELS[rule.op]);
                const value = conditionValueText(
                    fields.find((field) => field.id === rule.fieldId),
                    rule,
                    label
                );
                const text = `${path} ${op}${value ? ` ${value}` : ''}`;
                const suspect = suspectIds?.has(rule.id) ?? false;

                return (
                    <li
                        key={rule.id}
                        data-condition-chip
                        data-suspect={suspect || undefined}
                        title={text}
                        className={cn(
                            'inline-flex h-6 max-w-[20rem] items-center gap-1 rounded-[7px] text-xs font-medium',
                            onRemove ? 'pl-2 pr-0.5' : 'px-2',
                            suspect
                                ? 'bg-destructive-soft text-destructive-soft-foreground'
                                : 'bg-info-soft text-info-soft-foreground'
                        )}
                    >
                        <span className="min-w-0 truncate">
                            {path} <span className="font-normal">{op}</span>
                            {value ? <> {value}</> : null}
                            {suspect ? (
                                <span className="sr-only">
                                    {' '}
                                    {intl.formatMessage(messages.suspect)}
                                </span>
                            ) : null}
                        </span>
                        {onRemove ? (
                            <button
                                type="button"
                                data-condition-chip-remove
                                aria-label={intl.formatMessage(
                                    messages.remove,
                                    { label: text }
                                )}
                                onClick={(event) => {
                                    // Hand focus on before the chip unmounts,
                                    // or it falls to <body> and the next Tab
                                    // restarts at the top of the page.
                                    if (!focusSibling(event.currentTarget)) {
                                        onEmptied?.();
                                    }
                                    onRemove(rule.id);
                                }}
                                className="flex size-5 shrink-0 items-center justify-center rounded opacity-80 transition-colors hover:bg-current/10 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <X aria-hidden className="size-3.5" />
                            </button>
                        ) : null}
                    </li>
                );
            })}
        </ul>
    );
}

/**
 * Moves focus to the next chip's remove button, else the previous one.
 * Returns `false` when this was the only chip.
 */
function focusSibling(trigger: HTMLElement): boolean {
    const list = trigger.closest('ul');
    if (!list) return false;
    const removes = Array.from(
        list.querySelectorAll<HTMLElement>('[data-condition-chip-remove]')
    );
    const at = removes.indexOf(trigger);
    const target =
        (at >= 0 ? removes[at + 1] : undefined) ??
        (at > 0 ? removes[at - 1] : undefined);
    if (!target) return false;
    target.focus();
    return true;
}
