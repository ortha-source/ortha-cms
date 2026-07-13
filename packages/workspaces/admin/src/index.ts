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
// workspace (e.g. Content Library) contribute a route plus either a "Workspace"
// nav entry or a custom sidebar section here.
export {
    WORKSPACE_NAV_SLOT,
    WORKSPACE_SECTION_SLOT,
    WORKSPACE_ROUTE_SLOT
} from './lib/slots/workspaceSlots';
export type {
    WorkspaceNavItem,
    WorkspaceSectionItem,
    WorkspaceRoute
} from './lib/slots/workspaceSlots';
export { useCurrentWorkspace } from './lib/utils/currentWorkspace';
