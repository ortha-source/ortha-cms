import { Module, type DynamicModule } from '@nestjs/common';
import { ChangePlanner } from './application/change-planner';
import { LoadDocumentUseCase } from './application/load-document.use-case';
import { PlanSchemaUseCase } from './application/plan/plan-schema.use-case';
import { PreviewMigration } from './application/plan/preview-migration';
import { StageWriter } from './application/stage/stage-writer';
import { SchemaDocumentController } from './http/controllers/schema-document.controller';
import { SchemaPlanController } from './http/controllers/schema-plan.controller';
import { EditableGuard } from './http/guards/editable.guard';
import { newBootId } from './infrastructure/boot-id';
import { DrizzleKitGenerator } from './infrastructure/drizzle-kit/drizzle-kit.generator';
import { PrettierFormatter } from './infrastructure/formatter/prettier-formatter';
import { NodeSourceTree } from './infrastructure/source-tree/node-source-tree';
import { DrizzleContentStats } from './infrastructure/stats/drizzle-content-stats';
import {
    BOOT_ID,
    CODE_FORMATTER,
    CONTENT_STATS,
    MIGRATION_GENERATOR,
    SCHEMA_BUILDER_CONFIG,
    SOURCE_TREE
} from './schema-builder.tokens';
import {
    DEFAULT_GENERATE_TIMEOUT_MS,
    type SchemaBuilderPluginConfig
} from './types/schema-builder-config';

/** The schema builder's one dynamic module (ADR-0020). */
@Module({})
export class SchemaBuilderModule {
    static forRoot(config: SchemaBuilderPluginConfig): DynamicModule {
        const tree = new NodeSourceTree(config.projectRoot);
        return {
            module: SchemaBuilderModule,
            global: true,
            controllers: [SchemaDocumentController, SchemaPlanController],
            providers: [
                { provide: SCHEMA_BUILDER_CONFIG, useValue: config },
                { provide: BOOT_ID, useFactory: newBootId },
                { provide: SOURCE_TREE, useValue: tree },
                {
                    provide: CODE_FORMATTER,
                    useValue: new PrettierFormatter(config.projectRoot)
                },
                {
                    provide: MIGRATION_GENERATOR,
                    useValue: new DrizzleKitGenerator(
                        config.projectRoot,
                        tree,
                        config.generateTimeoutMs ?? DEFAULT_GENERATE_TIMEOUT_MS
                    )
                },
                { provide: CONTENT_STATS, useClass: DrizzleContentStats },
                LoadDocumentUseCase,
                ChangePlanner,
                StageWriter,
                PreviewMigration,
                PlanSchemaUseCase,
                EditableGuard
            ],
            exports: [SCHEMA_BUILDER_CONFIG, BOOT_ID, LoadDocumentUseCase]
        };
    }
}
