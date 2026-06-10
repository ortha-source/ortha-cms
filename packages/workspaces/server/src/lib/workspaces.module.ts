import { DynamicModule, Module } from '@nestjs/common';
import { ListWorkspacesController } from './workspaces/controllers/list-workspaces.controller';
import { WorkspacesService } from './workspaces/services/workspaces.service';

/**
 * NestJS module for the workspaces plugin. Mounts the read controller
 * (`GET /api/workspaces`) and its service. The service is private to this
 * module — nothing else injects it — so the module is neither global nor
 * exports it.
 *
 * The Drizzle client is injected straight from `@ortha-cms/database`'s global
 * `DatabaseModule` (`@InjectDatabase()`), and authentication comes from
 * identity's global `AuthGuard` — this module registers neither a db provider
 * nor a guard. It takes no config: the read surface has nothing to configure.
 */
@Module({})
export class WorkspacesModule {
    /** Creates the dynamic module: the read service + its controller. */
    static forRoot(): DynamicModule {
        return {
            module: WorkspacesModule,
            controllers: [ListWorkspacesController],
            providers: [WorkspacesService]
        };
    }
}
