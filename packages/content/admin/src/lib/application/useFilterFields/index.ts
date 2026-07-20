import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { STALE_TIME } from '@ortha-cms/utils-admin';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import type { FilterField } from '@ortha-cms/query-builder-admin';
import { filterFieldsKey } from '../../infrastructure/contentKeys';
import { httpContentGateway } from '../../infrastructure/httpContentGateway';
import { toFilterField } from '../../infrastructure/contentMapper';

export { filterFieldsKey } from '../../infrastructure/contentKeys';

/**
 * The type's filterable paths — the type's own fields plus, recursively, its
 * relations' fields (`author.name`) — served by the API and mapped to the
 * query-builder's `FilterField`.
 *
 * Deliberately **not** derived from `useContentSchema`: the surface is
 * recursive and the server owns the whitelist that decides which paths reach
 * SQL. Deriving it client-side would reintroduce the flat
 * `filterFieldsFromSchema` mirror — with a graph to walk, that drift becomes
 * user-visible 400s. Content types are code-defined, so the result only
 * changes on deploy (a standard staleTime avoids refetch churn).
 *
 * Returns the raw server-derived `FilterField[]`; callers append their own
 * slot-contributed fields (`RECORDS_FILTER_FIELDS_SLOT`), keeping the
 * rules-of-hooks-sensitive slot loop at the call site where it already lives.
 */
export function useFilterFields(typeName: string | undefined): FilterField[] {
    const workspace = useCurrentWorkspace();
    const query = useQuery({
        queryKey: filterFieldsKey(workspace.id, typeName ?? ''),
        queryFn: () => httpContentGateway.listFilterFields(typeName as string),
        enabled: Boolean(typeName),
        staleTime: STALE_TIME.Standard
    });
    return useMemo(
        () => (query.data ?? []).map((f) => toFilterField(typeName ?? '', f)),
        [query.data, typeName]
    );
}
