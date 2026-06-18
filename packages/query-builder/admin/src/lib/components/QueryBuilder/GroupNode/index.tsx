import { defineMessages, useIntl } from 'react-intl';
import { Plus, X } from 'lucide-react';
import {
    Button,
    SegmentedControl,
    SegmentedControlItem,
    cn
} from '@ortha-cms/design-system';
import type { FilterField } from '../../../types/filter-field.type';
import {
    COMBINATOR,
    isRule,
    type Combinator,
    type FilterGroup,
    type FilterRule
} from '../../../types/filter-tree.type';
import { RuleRow } from './RuleRow';

const messages = defineMessages({
    and: { id: 'qb.group.and', defaultMessage: 'AND' },
    or: { id: 'qb.group.or', defaultMessage: 'OR' },
    addRule: { id: 'qb.group.addRule', defaultMessage: 'Add rule' },
    addGroup: { id: 'qb.group.addGroup', defaultMessage: 'Add group' },
    removeGroup: {
        id: 'qb.group.removeGroup',
        defaultMessage: 'Remove group'
    },
    combinator: { id: 'qb.group.combinator', defaultMessage: 'Combinator' }
});

/** Bag of mutation callbacks the recursive group tree threads down. */
export type GroupNodeOps = {
    onAddRule: (parentGroupId: string) => void;
    onAddGroup: (parentGroupId: string) => void;
    onUpdateRule: (ruleId: string, patch: Partial<FilterRule>) => void;
    onUpdateCombinator: (groupId: string, combinator: Combinator) => void;
    onRemoveNode: (nodeId: string) => void;
};

/** Props for {@link GroupNode}. */
export type GroupNodeProps = {
    group: FilterGroup;
    fields: readonly FilterField[];
    /** True only for the outermost group — controls border + remove affordance. */
    isRoot?: boolean;
    ops: GroupNodeOps;
    /** Surface inline validation errors under invalid rules. */
    showErrors?: boolean;
};

/**
 * Recursive group renderer. Each group owns a combinator toggle, a list
 * of children (rules and nested groups), and a small footer with `Add
 * rule` / `Add group` actions. Non-root groups render with a dashed
 * border + "Remove group" affordance so the nesting structure is
 * legible without parentheses.
 */
export function GroupNode({
    group,
    fields,
    isRoot = false,
    ops,
    showErrors = false
}: GroupNodeProps) {
    const intl = useIntl();

    return (
        <div
            className={cn(
                'flex flex-col gap-2',
                !isRoot && 'rounded-md border border-dashed p-3'
            )}
        >
            <div className="flex items-center justify-between">
                <SegmentedControl
                    value={group.combinator}
                    onValueChange={(v) => {
                        if (v === COMBINATOR.And || v === COMBINATOR.Or) {
                            ops.onUpdateCombinator(group.id, v);
                        }
                    }}
                    aria-label={intl.formatMessage(messages.combinator)}
                >
                    <SegmentedControlItem value={COMBINATOR.And}>
                        {intl.formatMessage(messages.and)}
                    </SegmentedControlItem>
                    <SegmentedControlItem value={COMBINATOR.Or}>
                        {intl.formatMessage(messages.or)}
                    </SegmentedControlItem>
                </SegmentedControl>
                {!isRoot && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={intl.formatMessage(messages.removeGroup)}
                        onClick={() => ops.onRemoveNode(group.id)}
                        className="size-7"
                    >
                        <X aria-hidden className="size-3.5" />
                    </Button>
                )}
            </div>

            {group.children.length > 0 && (
                <div className="flex flex-col gap-2">
                    {group.children.map((child) =>
                        isRule(child) ? (
                            <RuleRow
                                key={child.id}
                                rule={child}
                                fields={fields}
                                onUpdate={(patch) =>
                                    ops.onUpdateRule(child.id, patch)
                                }
                                onRemove={() => ops.onRemoveNode(child.id)}
                                showErrors={showErrors}
                            />
                        ) : (
                            <GroupNode
                                key={child.id}
                                group={child}
                                fields={fields}
                                ops={ops}
                                showErrors={showErrors}
                            />
                        )
                    )}
                </div>
            )}

            <div className="flex gap-2">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => ops.onAddRule(group.id)}
                >
                    <Plus aria-hidden className="size-3.5" />
                    {intl.formatMessage(messages.addRule)}
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => ops.onAddGroup(group.id)}
                >
                    <Plus aria-hidden className="size-3.5" />
                    {intl.formatMessage(messages.addGroup)}
                </Button>
            </div>
        </div>
    );
}
