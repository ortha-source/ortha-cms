/**
 * Where an audience is used — the entries naming it, as the audience page and
 * its delete confirmation render them. Pure: no React, no HTTP.
 */

/** Which list of the entry names the audience. */
export const USAGE_STATE = {
    /** In the allow list — readers in the audience **can see** it. */
    Allow: 'allow',
    /** In the deny list — readers in the audience **cannot see** it. */
    Deny: 'deny'
} as const;

/** One value of {@link USAGE_STATE}. */
export type UsageState = (typeof USAGE_STATE)[keyof typeof USAGE_STATE];

/** One entry naming the audience, as `GET /segments/:id/usage` answers it. */
export type SegmentUsageItem = {
    entryId: string;
    typeSlug: string;
    /** The type's label, or its slug when the type is no longer registered. */
    typeLabel: string;
    /** `null` when the type is no longer registered. */
    title: string | null;
    /** The row's locale on a localized type. */
    locale: string | null;
    state: UsageState;
    /** In the trash — it still names the audience. */
    trashed: boolean;
};

/** Where one audience is used, in **one** workspace. */
export type SegmentUsage = {
    segmentId: string;
    /** Every entry of the workspace naming it — exact, past the page. */
    total: number;
    items: SegmentUsageItem[];
    truncated: boolean;
};

/** A usage item, with the workspace it was read from. */
export type WorkspaceUsageItem = SegmentUsageItem & {
    workspaceId: string;
    workspaceName: string;
};

/** The entries of one (workspace, type) pair — one records list. */
export type UsageGroup = {
    workspaceId: string;
    workspaceName: string;
    typeSlug: string;
    typeLabel: string;
    count: number;
};

/**
 * The wire names of the records list's access filter fields — the two that say
 * what an entry's own lists **name**. Matching `ACCESS_FILTER_FIELD` in
 * `@orthacms/segments-server`; see `useAccessFilterFields`.
 */
const NAMED_IN = ['audienceAllowed', 'audienceDenied'] as const;

/**
 * The `?filter=` a records list needs to show the entries naming an audience:
 * "Restricted to is one of X" **or** "Explicitly excluded is one of X".
 *
 * Built as the query builder's own wire JSON rather than a bespoke parameter,
 * so the list opens with two ordinary rule chips the editor can read, edit and
 * save as a view.
 */
export function namedInFilter(segmentId: string): string {
    return JSON.stringify({
        or: NAMED_IN.map((field) => ({ field, op: 'in', value: [segmentId] }))
    });
}

/** The records list of one type in one workspace, narrowed to the audience. */
export function recordsHref(
    workspaceId: string,
    typeSlug: string,
    segmentId: string
): string {
    return `/workspaces/${encodeURIComponent(workspaceId)}/content/${encodeURIComponent(
        typeSlug
    )}?filter=${encodeURIComponent(namedInFilter(segmentId))}`;
}

/** One entry's editor. */
export function entryHref(item: WorkspaceUsageItem): string {
    return `/workspaces/${encodeURIComponent(item.workspaceId)}/content/${encodeURIComponent(
        item.typeSlug
    )}/${encodeURIComponent(item.entryId)}`;
}

/**
 * The (workspace, type) pairs the items fall into, largest first — one records
 * list each, since a records list is one type in one workspace.
 */
export function usageGroups(
    items: readonly WorkspaceUsageItem[]
): UsageGroup[] {
    const groups = new Map<string, UsageGroup>();
    for (const item of items) {
        const key = `${item.workspaceId}\u0000${item.typeSlug}`;
        const group = groups.get(key);
        if (group) {
            group.count += 1;
        } else {
            groups.set(key, {
                workspaceId: item.workspaceId,
                workspaceName: item.workspaceName,
                typeSlug: item.typeSlug,
                typeLabel: item.typeLabel,
                count: 1
            });
        }
    }
    return [...groups.values()].sort(
        (a, b) =>
            b.count - a.count ||
            a.workspaceName.localeCompare(b.workspaceName) ||
            a.typeLabel.localeCompare(b.typeLabel)
    );
}

/**
 * What deleting the audience does to readers, split by the side that named it:
 *
 * - **allowed** — the entry stops being shown to this audience only; it follows
 *   its other rules, or becomes public when this was the only one;
 * - **denied** — readers in the audience can see it again.
 */
export function deleteConsequences(items: readonly WorkspaceUsageItem[]): {
    allowed: WorkspaceUsageItem[];
    denied: WorkspaceUsageItem[];
} {
    return {
        allowed: items.filter((item) => item.state === USAGE_STATE.Allow),
        denied: items.filter((item) => item.state === USAGE_STATE.Deny)
    };
}
