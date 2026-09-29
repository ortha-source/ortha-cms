import { useQuery } from '@tanstack/react-query';
import { useMatch } from 'react-router-dom';
import { STALE_TIME } from '@orthacms/utils-admin';
import { contentTypesKey } from '../../infrastructure/contentKeys';
import { httpContentGateway } from '../../infrastructure/httpContentGateway';

export { contentTypesKey } from '../../infrastructure/contentKeys';

/**
 * Loads the content-type catalogue for the Content Library sidebar and search
 * palette via the content gateway (`GET /content-schema` — the global,
 * code-defined list, not the workspace wizard's mock). Pass `enabled = false` to
 * defer the request until the caller has confirmed read permission. Returns the
 * standard TanStack Query result.
 *
 * Each type's `access` is answered for the workspace the request is scoped to
 * (the ambient `X-Workspace-Id`), so the cache is keyed by the open workspace —
 * read off the route rather than `useCurrentWorkspace`, because the sidebar's
 * Content section calls this from above the shell's provider.
 */
export function useContentTypes(enabled = true) {
    const workspaceId = useMatch('/workspaces/:id/*')?.params.id ?? null;
    return useQuery({
        queryKey: contentTypesKey(workspaceId),
        queryFn: () => httpContentGateway.listTypes(),
        staleTime: STALE_TIME.Standard,
        enabled
    });
}
