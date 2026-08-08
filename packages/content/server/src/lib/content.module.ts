import { DynamicModule, Module } from '@nestjs/common';
import {
    CONTENT_CATALOG,
    CONTENT_ENTRY_COUNTER,
    type ContentCatalog
} from '@ortha-cms/workspaces-server';
import { CONTENT_REGISTRY } from './content.tokens';
import type { ContentTypeRegistry } from './registry/content-type-registry';
import { ListContentSchemaController } from './content-types/controllers/list-content-schema.controller';
import { GetContentSchemaController } from './content-types/controllers/get-content-schema.controller';
import { GetFilterFieldsController } from './content-types/controllers/get-filter-fields.controller';
import { WorkspaceGrantsQuery } from './content-types/queries/workspace-grants.query';
import { ListEntriesController } from './entries/http/controllers/list-entries.controller';
import { BulkEntriesController } from './entries/http/controllers/bulk-entries.controller';
import { CreateEntryController } from './entries/http/controllers/create-entry.controller';
import { GetEntryController } from './entries/http/controllers/get-entry.controller';
import { UpdateEntryController } from './entries/http/controllers/update-entry.controller';
import { PublishEntryController } from './entries/http/controllers/publish-entry.controller';
import { DeleteEntryController } from './entries/http/controllers/delete-entry.controller';
import { EntryExtensionBootCheck } from './extension/entry-extension-boot-check';
import { EntryValidationService } from './validation/services/entry-validation.service';
import { EntriesService } from './entries/infrastructure/queries/entries.service';
import { MediaRefsQuery } from './entries/infrastructure/queries/media-refs.query';
import { EntryWriterService } from './entries/infrastructure/persistence/entry-writer.service';
import { EntryCounterService } from './entries/infrastructure/persistence/entry-counter.service';
import { RelationLinkService } from './entries/infrastructure/persistence/relation-link.service';
import { BulkPublishPreviewQuery } from './entries/infrastructure/queries/bulk-publish-preview.query';
import { PublishEntryUseCase } from './entries/application/use-cases/publish-entry.use-case';
import { UnpublishEntryUseCase } from './entries/application/use-cases/unpublish-entry.use-case';
import { BulkPublishEntriesUseCase } from './entries/application/use-cases/bulk-publish-entries.use-case';
import { BulkUnpublishEntriesUseCase } from './entries/application/use-cases/bulk-unpublish-entries.use-case';
import { REVISION_STORE } from './revisions/application/ports/revision-store';
import { DrizzleRevisionStore } from './revisions/infrastructure/persistence/drizzle-revision.store';
import { RestoreRevisionUseCase } from './revisions/application/use-cases/restore-revision.use-case';
import { PublishRevisionUseCase } from './revisions/application/use-cases/publish-revision.use-case';
import { RevisionRefsQuery } from './revisions/infrastructure/queries/revision-refs.query';
import { RevisionsController } from './revisions/http/controllers/revisions.controller';
import { RestoreRevisionController } from './revisions/http/controllers/restore-revision.controller';
import { PublishRevisionController } from './revisions/http/controllers/publish-revision.controller';
import { PublicContentTypesController } from './public-api/http/controllers/public-content-types.controller';
import { PublicEntriesController } from './public-api/http/controllers/public-entries.controller';
import { ApiTokenGuard } from './public-api/http/guards/api-token.guard';
import { ApiTokenWorkspaceGuard } from './public-api/http/guards/api-token-workspace.guard';
import { PublicEntriesQuery } from './public-api/infrastructure/public-entries.query';
import { PublicExpansionQuery } from './public-api/infrastructure/public-expansion.query';

/**
 * NestJS module for the content plugin. Registered globally so the
 * registry and validation service are injectable from any plugin (the
 * admin BFF, future provenance/audit features, identity's workspace
 * grants) without an explicit import.
 *
 * Owns no database schema of its own in this milestone — the HOST owns
 * the generated collection tables and their migrations; this module owns
 * the registry, its HTTP surface, and value validation.
 *
 * It also binds identity's {@link CONTENT_CATALOG} port to the registry, so
 * identity's `GET /api/content-types` and the workspace-grant flow resolve
 * against the real code-defined types instead of identity's built-in mock.
 */
@Module({})
export class ContentModule {
    /** Creates the global dynamic module around a validated registry. */
    static forRoot(registry: ContentTypeRegistry): DynamicModule {
        return {
            module: ContentModule,
            global: true,
            controllers: [
                ListContentSchemaController,
                // The `:name/filter-fields` route is more specific than
                // `GetContentSchemaController`'s `:name`, so their order is
                // immaterial, but keep the schema routes grouped.
                GetFilterFieldsController,
                GetContentSchemaController,
                // Bulk routes carry a literal `bulk` in the `:id` slot, so they
                // must be registered before the single-item controllers below
                // (`:typeName/:id/...`) to win the match. The list controller is
                // unaffected (`GET :typeName` is one segment shorter).
                BulkEntriesController,
                ListEntriesController,
                CreateEntryController,
                GetEntryController,
                UpdateEntryController,
                PublishEntryController,
                DeleteEntryController,
                // Revisions feature — the version timeline read + restore. Their
                // literal `revisions` segment can't collide with the single-item
                // routes above.
                RevisionsController,
                RestoreRevisionController,
                PublishRevisionController,
                // The public, token-authenticated read API (`/api/v1/...`).
                // Its own `v1` prefix keeps it clear of the admin routes, so
                // registration order relative to them doesn't matter; the
                // `v1/content-types` prefix likewise can't collide with
                // `v1/content/:typeName` (different first segment).
                PublicContentTypesController,
                PublicEntriesController
            ],
            providers: [
                { provide: CONTENT_REGISTRY, useValue: registry },
                {
                    // Adapt the registry to identity's catalogue port. Summaries
                    // are shape-compatible with `ContentTypeDescriptor`.
                    provide: CONTENT_CATALOG,
                    useFactory: (reg: ContentTypeRegistry): ContentCatalog => ({
                        list: () => reg.summaries()
                    }),
                    inject: [CONTENT_REGISTRY]
                },
                // Bind identity's entry-counter port to the registry-backed
                // counter, so the workspace "revoke content only when empty"
                // rule sees the real stored entries. Same inversion as the
                // catalogue above.
                EntryCounterService,
                {
                    provide: CONTENT_ENTRY_COUNTER,
                    useExisting: EntryCounterService
                },
                EntryValidationService,
                WorkspaceGrantsQuery,
                EntriesService,
                // Resolves media field ids → display refs (thumbnails); injected
                // by the entry-media read endpoint and the revision refs query.
                // No-ops when the media plugin binds no resolver.
                MediaRefsQuery,
                // The generic revision store, bound to its Drizzle adapter and
                // injected by EntryWriterService (snapshot-on-save) + the
                // revisions read/restore. Registered before EntryWriterService's
                // provider is resolved — Nest orders by the dependency graph.
                { provide: REVISION_STORE, useClass: DrizzleRevisionStore },
                RestoreRevisionUseCase,
                // Publish a specific version live (restore-if-needed + publish).
                PublishRevisionUseCase,
                // Resolves a previewed revision's relation ids to display refs
                // (the "exact linked records" the diff shows).
                RevisionRefsQuery,
                EntryWriterService,
                RelationLinkService,
                // Entries feature, layered per ADR-0003: the publish-lifecycle
                // use-cases (over the global UnitOfWork/OutboxWriter) + the
                // bulk-publish dry-run query. CRUD writes stay on the
                // persistence engine (EntryWriterService) directly.
                PublishEntryUseCase,
                UnpublishEntryUseCase,
                BulkPublishEntriesUseCase,
                BulkUnpublishEntriesUseCase,
                BulkPublishPreviewQuery,
                // Public API: the bearer guard (which resolves a token through
                // identity's exported `ApiTokenService`), the workspace
                // resolver, and the narrow published-only read.
                ApiTokenGuard,
                ApiTokenWorkspaceGuard,
                PublicEntriesQuery,
                // Batched relation + media expansion for the public reads.
                PublicExpansionQuery,
                // Fails boot when an i18n type has no CONTENT_ENTRY_EXTENSION
                // bound (nothing would stamp the NOT NULL locale column).
                EntryExtensionBootCheck
            ],
            exports: [
                CONTENT_REGISTRY,
                CONTENT_CATALOG,
                CONTENT_ENTRY_COUNTER,
                EntryValidationService
            ]
        };
    }
}
