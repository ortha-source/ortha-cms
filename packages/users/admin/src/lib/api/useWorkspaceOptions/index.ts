import { useQuery } from '@tanstack/react-query';
import {
    apiClient,
    asAvatarColor,
    initialsOf,
    toApiError
} from '@ortha-cms/utils-admin';
import type { AvatarColor } from '@ortha-cms/design-system';

/** A workspace as the invite wizard's assignment step renders it. */
export type WorkspaceOption = {
    id: string;
    name: string;
    description: string | null;
    initials: string;
    color: AvatarColor;
};

/** Only the fields the option list needs from `GET /api/workspaces`. */
type WorkspaceResponse = {
    id: string;
    name: string;
    description: string | null;
    color: string;
};

/** Query key for the workspace options list. */
export const workspaceOptionsKey = ['workspaces', 'options'] as const;

async function fetchWorkspaceOptions(): Promise<WorkspaceOption[]> {
    try {
        const { data } =
            await apiClient.get<WorkspaceResponse[]>('/workspaces');
        return data.map((workspace) => ({
            id: workspace.id,
            name: workspace.name,
            description: workspace.description,
            initials: initialsOf(workspace.name),
            color: asAvatarColor(workspace.color)
        }));
    } catch (error) {
        throw toApiError(error);
    }
}

/**
 * Lists every workspace (via the shared `GET /api/workspaces`) for the invite
 * wizard's "assign workspaces" step. `enabled` defers the fetch until the step
 * is reached.
 */
export function useWorkspaceOptions(enabled = true) {
    return useQuery({
        queryKey: workspaceOptionsKey,
        queryFn: fetchWorkspaceOptions,
        enabled,
        staleTime: 60_000
    });
}
