import { useMemo } from 'react';
import type { FilterField } from '../../types/filter-field.type';
import type { FilterGroup } from '../../types/filter-tree.type';
import { defaultValueForOp } from '../../utils/defaultValueForOp';
import { OPS_FOR_TYPE } from '../../utils/operators';
import {
    addGroupTo,
    addRuleTo,
    newGroup,
    newRule,
    removeNode,
    updateCombinator,
    updateRule
} from '../../utils/treeOps';
import { GroupNode, type GroupNodeOps } from './GroupNode';

/** Props for {@link QueryBuilder}. */
export type QueryBuilderProps = {
    /** Available filter fields — usually a static schema mirror of the BE filter spec. */
    fields: readonly FilterField[];
    /** Current tree, or null when no rules are set. Treated as the live-edit value. */
    value: FilterGroup | null;
    /**
     * Called on every edit (rule add / remove / update, group toggle,
     * sub-group add / remove). The consumer decides whether changes are
     * staged (commit on Apply) or applied immediately — the builder
     * itself is purely controlled.
     */
    onChange: (next: FilterGroup) => void;
    /**
     * When `true`, each invalid rule renders an inline validation
     * message under its row. The drawer flips this on after a failed
     * Apply so the user sees what to fix. Default `false`.
     */
    showErrors?: boolean;
};

/**
 * Visual filter-tree builder. Plain controlled component — the parent
 * owns the value and decides what "Apply" means (typically Apply +
 * Reset live in the host's footer). Supports OR + nested groups via
 * the recursive {@link GroupNode}; the recursive `FilterGroup` shape
 * means there's no depth limit on the FE state itself (the BE caps
 * group depth on its end via `maxGroupDepth`).
 */
export function QueryBuilder({
    fields,
    value,
    onChange,
    showErrors = false
}: QueryBuilderProps) {
    // Memoise the empty-state group so render stays pure: without this,
    // `newGroup()` runs on every render and produces a fresh id, which
    // means the next mutation operates against a different baseline
    // tree than the one currently on screen.
    const emptyTree = useMemo(() => newGroup(), []);
    const tree = value ?? emptyTree;

    const ops: GroupNodeOps = {
        onAddRule: (parentGroupId) => {
            const first = fields[0];
            if (!first) return;
            const op = OPS_FOR_TYPE[first.type][0];
            onChange(
                addRuleTo(
                    tree,
                    parentGroupId,
                    newRule(first.id, op, defaultValueForOp(op))
                )
            );
        },
        onAddGroup: (parentGroupId) => {
            onChange(addGroupTo(tree, parentGroupId, newGroup()));
        },
        onUpdateRule: (ruleId, patch) => {
            onChange(updateRule(tree, ruleId, patch));
        },
        onUpdateCombinator: (groupId, combinator) => {
            onChange(updateCombinator(tree, groupId, combinator));
        },
        onRemoveNode: (nodeId) => {
            onChange(removeNode(tree, nodeId));
        }
    };

    return (
        <GroupNode
            group={tree}
            fields={fields}
            isRoot
            ops={ops}
            showErrors={showErrors}
        />
    );
}
