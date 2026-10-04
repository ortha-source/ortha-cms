import { Module, type DynamicModule } from '@nestjs/common';
import { getDatabase } from '@orthacms/database';
import { ApplyJob } from './application/apply/apply-job';
import { ApplySchemaUseCase } from './application/apply/apply-schema.use-case';
import { ReadOperationUseCase } from './application/apply/read-operation.use-case';
import { StagePublisher } from './application/apply/stage-publisher';
import { ChangePlanner } from './application/change-planner';
import { LoadDocumentUseCase } from './application/load-document.use-case';
import { MigrationPhases } from './application/migrations/migration-phases';
import { PlanSchemaUseCase } from './application/plan/plan-schema.use-case';
import { PreviewMigration } from './application/plan/preview-migration';
import { StageWriter } from './application/stage/stage-writer';
import { SchemaApplyController } from './http/controllers/schema-apply.controller';
import { SchemaDocumentController } from './http/controllers/schema-document.controller';
import { SchemaOperationsController } from './http/controllers/schema-operations.controller';
import { SchemaPlanController } from './http/controllers/schema-plan.controller';
import { EditableGuard } from './http/guards/editable.guard';
import { OutboxSchemaAudit } from './infrastructure/audit/outbox-schema-audit';
import { newBootId } from './infrastructure/boot-id';
import { DrizzleKitGenerator } from './infrastructure/drizzle-kit/drizzle-kit.generator';
import { PrettierFormatter } from './infrastructure/formatter/prettier-formatter';
import { FileApplyLock } from './infrastructure/lock/file-apply-lock';
import { DrizzleMigrationRunner } from './infrastructure/migrate/drizzle-migration-runner';
import { FileOperationLog } from './infrastructure/operations/file-operation-log';
import { NodeSourceTree } from './infrastructure/source-tree/node-source-tree';
import { DrizzleContentStats } from './infrastructure/stats/drizzle-content-stats';
import {
    APPLY_LOCK,
    BOOT_ID,
    CODE_FORMATTER,
    CONTENT_STATS,
    MIGRATION_GENERATOR,
    MIGRATION_RUNNER,
    OPERATION_LOG,
    SCHEMA_AUDIT,
    SCHEMA_BUILDER_CONFIG,
    SOURCE_TREE
} from './schema-builder.tokens';
import {
    DEFAULT_GENERATE_TIMEOUT_MS,
    DEFAULT_MIGRATIONS_DIR,
    DEFAULT_MIGRATIONS_TABLE,
    type SchemaBuilderPluginConfig
} from './types/schema-builder-config';

/** The schema builder's one dynamic module (ADR-0020). */
@Module({})
export class SchemaBuilderModule {
    static forRoot(config: SchemaBuilderPluginConfig): DynamicModule {
        const root = config.projectRoot;
        const tree = new NodeSourceTree(root);
        return {
            module: SchemaBuilderModule,
            global: true,
            controllers: [
                SchemaDocumentController,
                SchemaPlanController,
                SchemaApplyController,
                SchemaOperationsController
            ],
            providers: [
                { provide: SCHEMA_BUILDER_CONFIG, useValue: config },
                { provide: BOOT_ID, useFactory: newBootId },
                { provide: SOURCE_TREE, useValue: tree },
                {
                    provide: CODE_FORMATTER,
                    useValue: new PrettierFormatter(root)
                },
                {
                    provide: MIGRATION_GENERATOR,
                    useValue: new DrizzleKitGenerator(
                        root,
                        tree,
                        config.generateTimeoutMs ?? DEFAULT_GENERATE_TIMEOUT_MS
                    )
                },
                {
                    provide: MIGRATION_RUNNER,
                    useFactory: () =>
                        DrizzleMigrationRunner.at(
                            getDatabase(),
                            root,
                            config.migrationsDir ?? DEFAULT_MIGRATIONS_DIR,
                            config.migrationsTable ?? DEFAULT_MIGRATIONS_TABLE
                        )
                },
                { provide: APPLY_LOCK, useValue: new FileApplyLock(root) },
                {
                    provide: OPERATION_LOG,
                    useValue: new FileOperationLog(tree)
                },
                { provide: CONTENT_STATS, useClass: DrizzleContentStats },
                { provide: SCHEMA_AUDIT, useClass: OutboxSchemaAudit },
                LoadDocumentUseCase,
                ChangePlanner,
                StageWriter,
                MigrationPhases,
                PreviewMigration,
                PlanSchemaUseCase,
                StagePublisher,
                ApplyJob,
                ApplySchemaUseCase,
                ReadOperationUseCase,
                EditableGuard
            ],
            exports: [SCHEMA_BUILDER_CONFIG, BOOT_ID, LoadDocumentUseCase]
        };
    }
}
