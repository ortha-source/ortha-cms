import { DynamicModule, Module } from '@nestjs/common';
import { ListWorkspacesController } from './workspaces/controllers/list-workspaces.controller';
import { WorkspacesService } from './workspaces/services/workspaces.service';

/**
 * NestJS module for the workspaces plugin. Registered globally so its read
 * service is injectable from any plugin module without an explicit import.
 *
 * Mounts the read controller (`GET /api/workspaces`). The Drizzle client is
 * injected straight from `@ortha-cms/database`'s global `DatabaseModule`
 * (`@InjectDatabase()`), and authentication comes from identity's global
 * `AuthGuard` — this module registers neither a db provider nor a guard. It
 * takes no config: the read surface has nothing to configure.
 */
@Module({})
export class WorkspacesModule {
    /** Creates the global dynamic module: the read service + its controller. */
    static forRoot(): DynamicModule {
        return {
            module: WorkspacesModule,
            global: true,
            controllers: [ListWorkspacesController],
            providers: [WorkspacesService],
            exports: [WorkspacesService]
        };
    }
}
