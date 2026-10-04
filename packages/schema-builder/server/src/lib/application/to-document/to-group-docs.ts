import type { AnyContentType } from '@orthacms/content-server';
import type { GroupDoc } from '@orthacms/schema-builder-domain';

/** A type's General-tab groups, in order, with defaults left implicit. */
export function toGroupDocs(type: AnyContentType): GroupDoc[] {
    return (type.groups ?? []).map((group) => ({
        key: group.key,
        label: group.label,
        ...(group.description ? { description: group.description } : {}),
        ...(group.collapsed ? { collapsed: true } : {})
    }));
}
