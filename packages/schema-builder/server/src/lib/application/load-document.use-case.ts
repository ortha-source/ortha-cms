import { Inject, Injectable } from '@nestjs/common';
import {
    CONTENT_REGISTRY,
    type ContentTypeRegistry
} from '@orthacms/content-server';
import {
    fingerprint,
    type SchemaDocumentEnvelope
} from '@orthacms/schema-builder-domain';
import type { SourceTree } from '../domain/ports/source-tree.port';
import {
    BOOT_ID,
    SCHEMA_BUILDER_CONFIG,
    SOURCE_TREE
} from '../schema-builder.tokens';
import {
    DEFAULT_CONTENT_DIR,
    type SchemaBuilderPluginConfig
} from '../types/schema-builder-config';
import { readCapabilities } from './to-document/read-capabilities';
import { readOrigin } from './to-document/read-origin';
import { toDocument } from './to-document/to-document';

/**
 * The content model this process serves, as an editable document. Read from
 * the running registry — not from the files — so it describes what is live;
 * only ownership comes from the files.
 */
@Injectable()
export class LoadDocumentUseCase {
    constructor(
        @Inject(CONTENT_REGISTRY)
        private readonly registry: ContentTypeRegistry,
        @Inject(SOURCE_TREE) private readonly tree: SourceTree,
        @Inject(SCHEMA_BUILDER_CONFIG)
        private readonly config: SchemaBuilderPluginConfig,
        @Inject(BOOT_ID) private readonly bootId: string
    ) {}

    async execute(): Promise<SchemaDocumentEnvelope> {
        const contentDir = this.config.contentDir ?? DEFAULT_CONTENT_DIR;
        const capabilities = await readCapabilities(
            this.tree,
            this.config,
            contentDir
        );
        const document = await toDocument(this.registry.all(), (type) =>
            readOrigin(this.tree, contentDir, type)
        );
        return {
            document,
            fingerprint: fingerprint(document),
            bootId: this.bootId,
            capabilities
        };
    }
}
