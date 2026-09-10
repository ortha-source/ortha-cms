export { WorkspacesPlugin } from './lib/presentation/workspacesPlugin';
export type { WorkspacesAdminPlugin } from './lib/presentation/workspacesPlugin';
export { useWorkspaces, workspacesKey } from './lib/application/useWorkspaces';
export { useCreateWorkspace } from './lib/application/useCreateWorkspace';
export type {
    Workspace,
    WorkspaceMember,
    WorkspaceStatus
} from './lib/domain/types/workspace';
// The workspace shell's extension points. Feature plugins that live inside a
// workspace (e.g. Content Library) contribute a route plus either a "Workspace"
// nav entry or a custom sidebar section here.
export {
    WORKSPACE_NAV_SLOT,
    WORKSPACE_SECTION_SLOT,
    WORKSPACE_ROUTE_SLOT,
    WORKSPACE_SETTINGS_TAB_SLOT
} from './lib/presentation/slots/workspaceSlots';
export type {
    WorkspaceNavItem,
    WorkspaceSectionItem,
    WorkspaceRoute,
    WorkspaceSettingsTab
} from './lib/presentation/slots/workspaceSlots';
export { useCurrentWorkspace } from './lib/presentation/currentWorkspace';
