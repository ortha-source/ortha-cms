import {
    isRule,
    type FilterGroup,
    type FilterRule
} from '../types/filter-tree.type';

/**
 * Total leaf-rule count anywhere in the tree, recursing through nested
 * groups. Useful for "Filters (N)" badges where the user expects N to
 * reflect the number of conditions, not just the count of top-level
 * children of the root group.
 *
 * Returns `0` for `null` / empty trees.
 */
export function countRules(tree: FilterGroup | null): number {
    if (!tree) return 0;
    return tree.children.reduce((sum, child) => sum + countNode(child), 0);
}

function countNode(node: FilterGroup | FilterRule): number {
    if (isRule(node)) return 1;
    return node.children.reduce((sum, child) => sum + countNode(child), 0);
}
