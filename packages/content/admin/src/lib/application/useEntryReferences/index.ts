import { useQuery } from '@tanstack/react-query';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import { entryReferencesKey } from '../../infrastructure/contentKeys';
import { httpContentGateway } from '../../infrastructure/httpContentGateway';

/**
 * Reads which records in the open workspace link to one entry, via
 * `GET /content/:name/:id/references` — per referring field, with how many are
 * live and what a purge would do to them. The delete and purge confirmations
 * ask it, so they can say what the action reaches before it is taken.
 *
 * Enabled only while the dialog is open (`enabled`), and always re-read then
 * (`staleTime: 0`): the answer is about this moment's links. `retry: false`,
 * since the dialog states the plain consequence without it and a retry would
 * only hold the sentence in its loading state for the backoff.
 */
export function useEntryReferences(
    name: string,
    id: string | undefined,
    enabled = true
) {
    const workspace = useCurrentWorkspace();
    return useQuery({
        queryKey: entryReferencesKey(workspace.id, name, id ?? ''),
        queryFn: () =>
            httpContentGateway.getEntryReferences(name, id as string),
        enabled: enabled && !!id,
        staleTime: 0,
        retry: false
    });
}
