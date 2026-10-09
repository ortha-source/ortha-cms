import type { GroupDoc } from '@orthacms/schema-builder-domain';

/**
 * A type's groups with the one keyed `key` moved to where the one keyed
 * `over` is — the order the General tab draws them in. Either key unknown,
 * or the two the same, it is the same list.
 */
export function moveGroup(
    groups: GroupDoc[],
    key: string,
    over: string
): GroupDoc[] {
    const from = groups.findIndex((group) => group.key === key);
    const to = groups.findIndex((group) => group.key === over);
    if (from < 0 || to < 0 || from === to) return groups;
    const next = [...groups];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
}
