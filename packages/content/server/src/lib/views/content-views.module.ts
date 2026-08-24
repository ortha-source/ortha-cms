import { Module, type DynamicModule } from '@nestjs/common';
import { WorkspaceGrantsQuery } from '../content-types/queries/workspace-grants.query';
import type { ContentTypeRegistry } from '../registry/content-type-registry';
import { VIEW_CONTENT_REGISTRY } from './views.tokens';
import { SAVED_VIEW_REPOSITORY } from './domain/saved-view.repository';
import { DrizzleSavedViewRepository } from './infrastructure/persistence/drizzle-saved-view.repository';
import { SavedViewsQuery } from './application/queries/saved-views.query';
import { SavedViewAccessService } from './application/saved-view-access.service';
import { ViewScopeService } from './application/view-scope.service';
import { CreateSavedViewUseCase } from './application/use-cases/create-saved-view.use-case';
import { UpdateSavedViewUseCase } from './application/use-cases/update-saved-view.use-case';
import { DeleteSavedViewUseCase } from './application/use-cases/delete-saved-view.use-case';
import { SetDefaultViewUseCase } from './application/use-cases/set-default-view.use-case';
import { SavedViewsController } from './http/controllers/saved-views.controller';

/**
 * The saved-views module.
 *
 * A **second** module from this package rather than a branch of
 * `ContentModule`, because it needs its own `ServerPlugin` entry — the contract
 * carries exactly one `migrations` descriptor per plugin, and content's is
 * already spent on the host-owned generated collection tables. Splitting the
 * module keeps that seam honest: the views feature owns fixed tables it ships
 * migrations for, and the content model's tables stay the host's.
 *
 * It provides the registry the plugin factory hands it under its **own** token
 * (`VIEW_CONTENT_REGISTRY`), so `ViewScopeService` can resolve a scope without
 * importing `ContentModule` — which would make the two plugins' load order
 * load-bearing — and without two global modules both claiming
 * `CONTENT_REGISTRY`.
 */
@Module({})
export class ContentViewsModule {
    static forRoot(registry: ContentTypeRegistry): DynamicModule {
        return {
            module: ContentViewsModule,
            global: true,
            controllers: [SavedViewsController],
            providers: [
                { provide: VIEW_CONTENT_REGISTRY, useValue: registry },
                {
                    provide: SAVED_VIEW_REPOSITORY,
                    useClass: DrizzleSavedViewRepository
                },
                WorkspaceGrantsQuery,
                SavedViewsQuery,
                SavedViewAccessService,
                ViewScopeService,
                CreateSavedViewUseCase,
                UpdateSavedViewUseCase,
                DeleteSavedViewUseCase,
                SetDefaultViewUseCase
            ],
            exports: [SavedViewsQuery]
        };
    }
}
