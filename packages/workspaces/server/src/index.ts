export { WorkspacesPlugin } from './lib/utils/workspaces-plugin';
export type { WorkspacesServerPlugin } from './lib/utils/workspaces-plugin';
export { WorkspacesModule } from './lib/workspaces.module';
export { WorkspaceGuard } from './lib/workspace/http/guards/workspace.guard';
// The `:id`-scoped sibling of `WorkspaceGuard`, for routes that name their
// workspace in the path instead of the `X-Workspace-Id` header.
export { WorkspaceMemberGuard } from './lib/workspace/http/guards/workspace-member.guard';
export { CurrentWorkspace } from './lib/workspace/http/decorators/current-workspace.decorator';
// The membership probe behind `WorkspaceGuard`, exported for the rare route
// that must derive its workspace from the resource rather than the
// `X-Workspace-Id` header — e.g. media's raw-bytes route, whose URL is fetched
// by the browser (`<img src>`), which can't send custom headers.
export { MembershipCheckQuery } from './lib/workspace/infrastructure/queries/membership-check.query';
export {
    lockWorkspaceShared,
    lockWorkspaceExclusive
} from './lib/workspace/infrastructure/persistence/workspace-lock';
export type { LockExecutor } from './lib/workspace/infrastructure/persistence/workspace-lock';
export { CONTENT_CATALOG } from './lib/workspace/application/ports/content-catalog.port';
export type { ContentCatalog } from './lib/workspace/application/ports/content-catalog.port';
export { CONTENT_ENTRY_COUNTER } from './lib/workspace/application/ports/content-entry-counter.port';
export type { ContentEntryCounter } from './lib/workspace/application/ports/content-entry-counter.port';
export type { ContentTypeDescriptor } from './lib/workspace/application/ports/content-type-descriptor';
export * from './lib/workspace/infrastructure/schema';
