import { DynamicModule, Module } from '@nestjs/common';
import { ACTIVITY_RECORDER } from '@ortha-cms/activity-contract';
import { ListActivityController } from './activity/controllers/list-activity.controller';
import { ActivityService } from './activity/services/activity.service';

/**
 * NestJS module for the activity plugin. Mounts the read API under
 * `/api/activity` and provides {@link ActivityService}.
 *
 * **Global**, so any plugin can record without re-importing the module, and it
 * binds `ActivityService` to the `ACTIVITY_RECORDER` token: foundational
 * plugins (identity) inject that token — never the concrete service — so they
 * stay free of a dependency on this package (keeping the graph acyclic). The
 * Drizzle client comes from `@ortha-cms/database`'s global `DatabaseModule`;
 * authorization from identity's `PermissionsGuard`.
 */
@Module({})
export class ActivityModule {
    /** Creates the dynamic module: the read controller + the recorder. */
    static forRoot(): DynamicModule {
        return {
            module: ActivityModule,
            global: true,
            controllers: [ListActivityController],
            providers: [
                ActivityService,
                { provide: ACTIVITY_RECORDER, useExisting: ActivityService }
            ],
            exports: [ActivityService, ACTIVITY_RECORDER]
        };
    }
}
