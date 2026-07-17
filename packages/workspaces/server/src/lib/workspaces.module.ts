import { DynamicModule, Module } from '@nestjs/common';
import { CreateWorkspaceController } from './workspaces/controllers/create-workspace.controller';
import { ListWorkspacesController } from './workspaces/controllers/list-workspaces.controller';
import { CheckSlugController } from './workspaces/controllers/check-slug.controller';
import { UpdateWorkspaceController } from './workspaces/controllers/update-workspace.controller';
import { SetWorkspaceStatusController } from './workspaces/controllers/set-workspace-status.controller';
import { DeleteWorkspaceController } from './workspaces/controllers/delete-workspace.controller';
import { AddWorkspaceMemberController } from './workspaces/controllers/add-workspace-member.controller';
import { RemoveWorkspaceMemberController } from './workspaces/controllers/remove-workspace-member.controller';
import { AddWorkspaceContentController } from './workspaces/controllers/add-workspace-content.controller';
import { RemoveWorkspaceContentController } from './workspaces/controllers/remove-workspace-content.controller';
import { GetWorkspaceContentCountController } from './workspaces/controllers/get-workspace-content-count.controller';
import { GetWorkspaceEntryCountController } from './workspaces/controllers/get-workspace-entry-count.controller';
import { WorkspaceService } from './workspaces/services/workspace.service';
import { SlugService } from './workspaces/services/slug.service';
import { MembershipService } from './workspaces/services/membership.service';
import { ContentGrantService } from './workspaces/services/content-grant.service';
import { WorkspaceGuard } from './workspaces/guards/workspace.guard';
import { ListContentTypesController } from './content/controllers/list-content-types.controller';

/**
 * NestJS module for the workspaces plugin. Registered globally so its guard
 * and membership check are injectable from any plugin (content, i18n) that
 * scopes routes with `@UseGuards(WorkspaceGuard)`, without an explicit import.
 *
 * Owns the tenancy schema (workspaces / memberships / workspace_content) and
 * the workspace read/write endpoints, plus the `content-types` listing and the
 * `CONTENT_CATALOG` / `CONTENT_ENTRY_COUNTER` ports the content plugin binds.
 * The Drizzle client is injected straight from `@ortha-cms/database`'s global
 * `DatabaseModule` (`@InjectDatabase()`), so this module registers no db
 * provider of its own; identity's tables (`users`, `roles`) are reached through
 * `@ortha-cms/identity-server`.
 */
@Module({})
export class WorkspacesModule {
    /** Creates the global dynamic module: workspace services and routes. */
    static forRoot(): DynamicModule {
        return {
            module: WorkspacesModule,
            global: true,
            controllers: [
                CreateWorkspaceController,
                ListWorkspacesController,
                CheckSlugController,
                UpdateWorkspaceController,
                SetWorkspaceStatusController,
                DeleteWorkspaceController,
                AddWorkspaceMemberController,
                RemoveWorkspaceMemberController,
                AddWorkspaceContentController,
                RemoveWorkspaceContentController,
                GetWorkspaceContentCountController,
                GetWorkspaceEntryCountController,
                ListContentTypesController
            ],
            providers: [
                WorkspaceService,
                SlugService,
                MembershipService,
                ContentGrantService,
                // Resolved by `@UseGuards(WorkspaceGuard)` on workspace-scoped
                // routes in other plugins; injectable everywhere since this
                // module is global (same pattern as identity's PermissionsGuard).
                WorkspaceGuard
            ],
            exports: [
                // Exported so a feature plugin's `@UseGuards(WorkspaceGuard)`
                // (instantiated in the consuming module's injector) can resolve
                // the guard and its `MembershipService` dependency.
                MembershipService,
                WorkspaceGuard
            ]
        };
    }
}
