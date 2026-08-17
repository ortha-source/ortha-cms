import { useMemo } from 'react';
import type {
    FilterField,
    RelationValueEditor
} from '../../types/filter-field.type';
import type { FilterGroup } from '../../types/filter-tree.type';
import { defaultValueForOp } from '../../utils/defaultValueForOp';
import { opsForField } from '../../utils/operators';
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
import { PortalContainerContext } from '../portalContainer';

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
    /**
     * Renders the value editor for a rule whose field carries a
     * `relationTarget` (a relation's `id`). Injected because this package
     * has no data layer. Omit it and relation-id rules use the raw uuid
     * input.
     */
    renderRelationValue?: RelationValueEditor;
    /**
     * DOM node the nested popovers (field picker, relation value picker) portal
     * into. Set it to the scroll-locking ancestor's element (a drawer / dialog)
     * so their lists scroll by mouse wheel; the `QueryBuilderDrawer` wires this
     * automatically. Defaults to `document.body`.
     */
    portalContainer?: HTMLElement | null;
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
    showErrors = false,
    renderRelationValue,
    portalContainer
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
            // `opsForField`, not `OPS_FOR_TYPE`, so a field that narrows its
            // operator set (a virtual field answered by a subquery, say) is
            // seeded with an operator it actually offers. Seeding from the
            // type alone put "Add rule" and the operator picker on different
            // vocabularies — the one place `FilterField.operators` was not
            // being honoured.
            const op = opsForField(first)[0];
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
        <PortalContainerContext.Provider value={portalContainer ?? null}>
            <GroupNode
                group={tree}
                fields={fields}
                isRoot
                ops={ops}
                showErrors={showErrors}
                renderRelationValue={renderRelationValue}
            />
        </PortalContainerContext.Provider>
    );
}
