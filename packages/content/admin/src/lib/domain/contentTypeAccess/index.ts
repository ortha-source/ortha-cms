import type {
    ContentType,
    ContentTypeAccess,
    EntrySource,
    EntrySourceScope
} from '../types/contentType';

/**
 * What an absent `access` means: the type is the workspace's own and nothing
 * is shared — the only reading a server predating per-source grants allows.
 */
export const OWN_ONLY_ACCESS: ContentTypeAccess = Object.freeze({
    own: true,
    sharedSources: []
}) as ContentTypeAccess;

/** A type's access, normalized (absent ≡ {@link OWN_ONLY_ACCESS}). */
export function accessOf(type: ContentType): ContentTypeAccess {
    return type.access ?? OWN_ONLY_ACCESS;
}

/**
 * Scopes the global catalogue to what the open workspace can reach, and folds
 * the workspace's own grants into each type's `access.own`:
 *
 * - **own** needs both the server's verdict and an own grant in
 *   `ownGrants` (`Workspace.content`) — so an older server, whose fallback
 *   reads every type as own, still only yields the granted ones;
 * - a type reached **only** through shared grants stays, with `own: false`;
 * - a type reached neither way is dropped.
 *
 * Every consumer downstream reads `access.own` as "may create here".
 */
export function scopeContentTypes(
    types: readonly ContentType[],
    ownGrants: readonly string[]
): ContentType[] {
    const granted = new Set(ownGrants);
    const scoped: ContentType[] = [];
    for (const type of types) {
        const access = accessOf(type);
        const own = access.own && granted.has(type.name);
        if (!own && access.sharedSources.length === 0) continue;
        scoped.push({
            ...type,
            access: { own, sharedSources: access.sharedSources }
        });
    }
    return scoped;
}

/** Whether the open workspace may hold (and create) its own records of `type`. */
export function hasOwnAccess(type: ContentType): boolean {
    return accessOf(type).own;
}

/** One shared workspace and the types the open workspace reads from it. */
export type SharedSourceGroup = {
    /** The shared workspace. */
    source: EntrySource;
    /** Its types this workspace was granted, in catalogue order. */
    types: ContentType[];
};

/**
 * Groups types by the shared workspaces they are reached from — the sidebar's
 * "From {workspace}" sections. A type granted from two sources is in both;
 * sources keep first-seen order, types keep catalogue order.
 */
export function sharedSourceGroups(
    types: readonly ContentType[]
): SharedSourceGroup[] {
    const groups = new Map<string, SharedSourceGroup>();
    for (const type of types) {
        for (const source of accessOf(type).sharedSources) {
            const group = groups.get(source.workspaceId) ?? {
                source,
                types: []
            };
            group.types.push(type);
            groups.set(source.workspaceId, group);
        }
    }
    return [...groups.values()];
}

/** The shared source `sourceId` of `type`, if the workspace reaches it there. */
export function sharedSourceOf(
    type: ContentType,
    sourceId: string | undefined
): EntrySource | undefined {
    if (!sourceId) return undefined;
    return accessOf(type).sharedSources.find(
        (source) => source.workspaceId === sourceId
    );
}

/**
 * Every type name the workspace can reach at all — its own grants plus the
 * ones granted from a shared workspace that still shares. What the entry
 * editor offers relations to: a relation whose target is reachable only from
 * a shared source is still one an editor can fill.
 */
export function reachableTypeNames(workspace: {
    content: readonly string[];
    sharedContent?: readonly { slug: string; available: boolean }[];
}): string[] {
    const names = new Set(workspace.content);
    for (const grant of workspace.sharedContent ?? []) {
        if (grant.available) names.add(grant.slug);
    }
    return [...names];
}

/**
 * The relation picker's Source choice: every reachable source (`all`), this
 * workspace's own records (`own`), or one shared workspace
 * (`shared:<workspaceId>`).
 */
export type SourceChoice = 'all' | 'own' | `shared:${string}`;

/** The {@link SourceChoice} naming one shared workspace. */
export function sharedChoice(workspaceId: string): SourceChoice {
    return `shared:${workspaceId}`;
}

/**
 * The choices the picker offers for a target type: always **all**; **own**
 * only when the workspace holds its own records of the target; one per shared
 * workspace it reads the target from — so a target reached only from shared
 * workspaces never offers "This workspace".
 */
export function sourceChoices(access: ContentTypeAccess): SourceChoice[] {
    return [
        'all',
        ...(access.own ? (['own'] as const) : []),
        ...access.sharedSources.map((source) =>
            sharedChoice(source.workspaceId)
        )
    ];
}

/**
 * What a choice asks the list for: the `?source=` scope, plus — for one shared
 * workspace — the `?sourceWorkspaceId=` the server narrows to (items, total
 * and pages alike).
 */
export function sourceChoiceScope(choice: SourceChoice): {
    scope: EntrySourceScope;
    workspaceId?: string;
} {
    if (choice === 'all' || choice === 'own') return { scope: choice };
    return { scope: 'shared', workspaceId: choice.slice('shared:'.length) };
}
