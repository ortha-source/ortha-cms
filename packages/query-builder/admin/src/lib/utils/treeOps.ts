import {
    COMBINATOR,
    isRule,
    type Combinator,
    type FilterGroup,
    type FilterRule,
    type OpId,
    type RuleValue
} from '../types/filter-tree.type';
import { newId } from './newId';

/**
 * Build an empty group. `idFactory` is exposed so unit tests can pin
 * generated ids and the builder can share a single factory across all
 * inserts inside one render.
 */
export const newGroup = (
    combinator: Combinator = COMBINATOR.And,
    idFactory: () => string = newId
): FilterGroup => ({
    id: idFactory(),
    combinator,
    children: []
});

/** Build a placeholder rule pointing at a given field/op with an empty value. */
export const newRule = (
    fieldId: string,
    op: OpId,
    value: RuleValue = '',
    idFactory: () => string = newId
): FilterRule => ({
    id: idFactory(),
    fieldId,
    op,
    value
});

/**
 * Append a rule (or group) to the root, returning a new tree. Kept for
 * the small number of callers that already hold a root reference; for
 * nested-group inserts use {@link addRuleTo} / {@link addGroupTo}.
 */
export const addChild = (
    tree: FilterGroup,
    child: FilterGroup | FilterRule
): FilterGroup => ({
    ...tree,
    children: [...tree.children, child]
});

/** Append a rule to the group identified by `parentId`, anywhere in the tree. */
export const addRuleTo = (
    tree: FilterGroup,
    parentId: string,
    rule: FilterRule
): FilterGroup =>
    mapGroup(tree, parentId, (g) => ({
        ...g,
        children: [...g.children, rule]
    }));

/** Append a sub-group to the group identified by `parentId`. */
export const addGroupTo = (
    tree: FilterGroup,
    parentId: string,
    group: FilterGroup
): FilterGroup =>
    mapGroup(tree, parentId, (g) => ({
        ...g,
        children: [...g.children, group]
    }));

/**
 * Remove a node (rule or group) by id. The root group can't be removed
 * — callers should treat an empty root as the "no filter" state instead.
 */
export const removeNode = (tree: FilterGroup, nodeId: string): FilterGroup => ({
    ...tree,
    children: tree.children
        .filter((c) => c.id !== nodeId)
        .map((c) => (isRule(c) ? c : removeNode(c, nodeId)))
});

/** Replace a rule's properties in place by id, anywhere in the tree. */
export const updateRule = (
    tree: FilterGroup,
    ruleId: string,
    patch: Partial<FilterRule>
): FilterGroup => ({
    ...tree,
    children: tree.children.map((c) => {
        if (isRule(c)) return c.id === ruleId ? { ...c, ...patch } : c;
        return updateRule(c, ruleId, patch);
    })
});

/** Flip a group's combinator (`and` ↔ `or`) by id, anywhere in the tree. */
export const updateCombinator = (
    tree: FilterGroup,
    groupId: string,
    combinator: Combinator
): FilterGroup => mapGroup(tree, groupId, (g) => ({ ...g, combinator }));

function mapGroup(
    tree: FilterGroup,
    targetId: string,
    fn: (g: FilterGroup) => FilterGroup
): FilterGroup {
    if (tree.id === targetId) return fn(tree);
    return {
        ...tree,
        children: tree.children.map((c) =>
            isRule(c) ? c : mapGroup(c, targetId, fn)
        )
    };
}
