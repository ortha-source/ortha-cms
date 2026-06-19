export { WorkspacesPlugin } from './lib/utils/workspacesPlugin';
export type { WorkspacesAdminPlugin } from './lib/utils/workspacesPlugin';
export { useWorkspaces, workspacesKey } from './lib/api/useWorkspaces';
export { useCreateWorkspace } from './lib/api/useCreateWorkspace';
export type {
    Workspace,
    WorkspaceMember,
    WorkspaceStatus
} from './lib/types/workspace';
// The workspace shell's extension points. Feature plugins that live inside a
// workspace (e.g. Content Library) contribute a rail button + a route here.
export {
    WORKSPACE_SIDEBAR_SLOT,
    WORKSPACE_ROUTE_SLOT
} from './lib/slots/workspaceSlots';
export type {
    WorkspaceNavItem,
    WorkspaceRoute
} from './lib/slots/workspaceSlots';
export { useCurrentWorkspace } from './lib/utils/currentWorkspace';
