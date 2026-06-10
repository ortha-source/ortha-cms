import { useQuery } from '@tanstack/react-query';
import { listWorkspaces } from '../workspacesClient';

/** Query key for the workspaces list. */
export const workspacesKey = ['workspaces'] as const;

/** Fetches the list of workspaces. */
export function useWorkspaces() {
    return useQuery({
        queryKey: workspacesKey,
        queryFn: listWorkspaces
    });
}
