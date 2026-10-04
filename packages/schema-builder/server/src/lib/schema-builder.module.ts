import { Module, type DynamicModule } from '@nestjs/common';
import { LoadDocumentUseCase } from './application/load-document.use-case';
import { SchemaDocumentController } from './http/controllers/schema-document.controller';
import { newBootId } from './infrastructure/boot-id';
import { NodeSourceTree } from './infrastructure/source-tree/node-source-tree';
import {
    BOOT_ID,
    SCHEMA_BUILDER_CONFIG,
    SOURCE_TREE
} from './schema-builder.tokens';
import type { SchemaBuilderPluginConfig } from './types/schema-builder-config';

/** The schema builder's one dynamic module (ADR-0020). */
@Module({})
export class SchemaBuilderModule {
    static forRoot(config: SchemaBuilderPluginConfig): DynamicModule {
        return {
            module: SchemaBuilderModule,
            global: true,
            controllers: [SchemaDocumentController],
            providers: [
                { provide: SCHEMA_BUILDER_CONFIG, useValue: config },
                { provide: BOOT_ID, useFactory: newBootId },
                {
                    provide: SOURCE_TREE,
                    useValue: new NodeSourceTree(config.projectRoot)
                },
                LoadDocumentUseCase
            ],
            exports: [SCHEMA_BUILDER_CONFIG, BOOT_ID, LoadDocumentUseCase]
        };
    }
}
