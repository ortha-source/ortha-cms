/**
 * Query keys for every content cache, in one place so the reads, the mutation
 * invalidations, and the slot-contributor invalidations (re-exported through the
 * barrel) all build the same keys. Entry-scoped keys are **workspace-scoped** —
 * two workspaces never share a cache entry, so switching workspaces can't surface
 * the other's rows from cache (the request, and its `X-Workspace-Id` header,
 * never fires on a cache hit).
 */

/** List params for a collection's records, mirroring the Members list shape. */
export type ContentEntriesParams = {
    /** Free-text search across the row's textual values. */
    search?: string;
    /** Query-builder wire JSON (`?filter=` payload). */
    filter?: string;
    /** Sort: a column id (ascending) or `-`-prefixed (descending). */
    sort?: string;
    /** 1-based page. */
    page: number;
    /** Rows per page. */
    pageSize: number;
    /** `only` lists soft-deleted rows (the trash view) instead of live ones. */
    deleted?: 'only';
    /**
     * Slot-contributed list params (e.g. `?locale=` from the records-toolbar
     * slot), forwarded to the request verbatim. Part of this object, so they ride
     * the query key — two param sets never share a cache entry.
     */
    extra?: Record<string, string | undefined>;
};

/** The content-type catalogue list. Deliberately distinct from `content-schema`. */
export const contentTypesKey = ['content-types'] as const;

/** One content type's full field schema. */
export const contentSchemaKey = (name: string) =>
    ['content-schema', name] as const;

/** One collection's records list page, scoped to the workspace. */
export const contentEntriesKey = (
    workspaceId: string,
    name: string,
    params: ContentEntriesParams
) => ['content-entries', workspaceId, name, params] as const;

/** Prefix over every records-list query for a type in a workspace. */
export const contentEntriesPrefix = (workspaceId: string, name: string) =>
    ['content-entries', workspaceId, name] as const;

/** One entry's read-one fetch, scoped to the workspace. */
export const contentEntryKey = (
    workspaceId: string,
    name: string,
    id: string
) => ['content-entry', workspaceId, name, id] as const;

/** Prefix over every read-one query for a type in a workspace. */
export const contentEntryPrefix = (workspaceId: string, name: string) =>
    ['content-entry', workspaceId, name] as const;

/** One entry's relation links (all fields, first page + total), workspace-scoped. */
export const entryRelationsKey = (
    workspaceId: string,
    name: string,
    id: string
) => ['content-entry-relations', workspaceId, name, id] as const;

/** Prefix over every relations query for a type in a workspace. */
export const entryRelationsPrefix = (workspaceId: string, name: string) =>
    ['content-entry-relations', workspaceId, name] as const;

/** One relation field's paginated links, workspace-scoped. */
export const relationFieldLinksKey = (
    workspaceId: string,
    name: string,
    id: string,
    field: string
) => ['content-relation-field', workspaceId, name, id, field] as const;

/** Prefix over every relation-field query for a type in a workspace. */
export const relationFieldLinksPrefix = (workspaceId: string, name: string) =>
    ['content-relation-field', workspaceId, name] as const;

/**
 * A relation type's candidate list, workspace-scoped. The serialized filter — not
 * the tree object — keys the entry so an unchanged filter is a cache hit.
 */
export const relationCandidatesKey = (
    workspaceId: string,
    targetName: string,
    params: {
        search: string;
        filter: string | null;
        extra?: Record<string, string>;
    }
) => ['relation-candidates', workspaceId, targetName, params] as const;
