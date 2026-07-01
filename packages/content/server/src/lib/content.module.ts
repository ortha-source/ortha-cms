import { DynamicModule, Module } from '@nestjs/common';
import {
    CONTENT_CATALOG,
    CONTENT_ENTRY_COUNTER,
    type ContentCatalog
} from '@ortha-cms/identity-server';
import { CONTENT_REGISTRY } from './content.tokens';
import type { ContentTypeRegistry } from './registry/content-type-registry';
import { ListContentSchemaController } from './content-types/controllers/list-content-schema.controller';
import { GetContentSchemaController } from './content-types/controllers/get-content-schema.controller';
import { ListEntriesController } from './entries/controllers/list-entries.controller';
import { BulkEntriesController } from './entries/controllers/bulk-entries.controller';
import { CreateEntryController } from './entries/controllers/create-entry.controller';
import { GetEntryController } from './entries/controllers/get-entry.controller';
import { UpdateEntryController } from './entries/controllers/update-entry.controller';
import { PublishEntryController } from './entries/controllers/publish-entry.controller';
import { DeleteEntryController } from './entries/controllers/delete-entry.controller';
import { EntryValidationService } from './validation/services/entry-validation.service';
import { EntriesService } from './entries/services/entries.service';
import { EntryWriterService } from './entries/services/entry-writer.service';
import { EntryCounterService } from './entries/services/entry-counter.service';

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
                DeleteEntryController
            ],
            providers: [
                { provide: CONTENT_REGISTRY, useValue: registry },
                {
                    // Adapt the registry to identity's catalogue port. Summaries
                    // are shape-compatible with `ContentTypeDescriptor`.
                    provide: CONTENT_CATALOG,
                    useFactory: (
                        reg: ContentTypeRegistry
                    ): ContentCatalog => ({ list: () => reg.summaries() }),
                    inject: [CONTENT_REGISTRY]
                },
                // Bind identity's entry-counter port to the registry-backed
                // counter, so the workspace "revoke content only when empty"
                // rule sees the real stored entries. Same inversion as the
                // catalogue above.
                EntryCounterService,
                { provide: CONTENT_ENTRY_COUNTER, useExisting: EntryCounterService },
                EntryValidationService,
                EntriesService,
                EntryWriterService
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
