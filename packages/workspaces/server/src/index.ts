export { WorkspacesPlugin } from './lib/utils/workspaces-plugin';
export type { WorkspacesServerPlugin } from './lib/utils/workspaces-plugin';
export { WorkspacesModule } from './lib/workspaces.module';
export { WorkspaceGuard } from './lib/workspace/http/guards/workspace.guard';
export { CurrentWorkspace } from './lib/workspace/http/decorators/current-workspace.decorator';
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
