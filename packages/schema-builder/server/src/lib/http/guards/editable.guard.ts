import { Inject, Injectable, type CanActivate } from '@nestjs/common';
import { readCapabilities } from '../../application/to-document/read-capabilities';
import { builderPaths } from '../../domain/builder-paths';
import { EditingDisabledError } from '../../domain/errors';
import type { SourceTree } from '../../domain/ports/source-tree.port';
import {
    SCHEMA_BUILDER_CONFIG,
    SOURCE_TREE
} from '../../schema-builder.tokens';
import type { SchemaBuilderPluginConfig } from '../../types/schema-builder-config';

/**
 * [schema-builder:I-01] Production, the flag off, no source tree, or a
 * hand-written manifest: every write route refuses before its handler runs —
 * the same verdict the document reports as `capabilities`.
 */
@Injectable()
export class EditableGuard implements CanActivate {
    constructor(
        @Inject(SCHEMA_BUILDER_CONFIG)
        private readonly config: SchemaBuilderPluginConfig,
        @Inject(SOURCE_TREE) private readonly tree: SourceTree
    ) {}

    async canActivate(): Promise<boolean> {
        const { editable, reason } = await readCapabilities(
            this.tree,
            this.config,
            builderPaths(this.config).content
        );
        if (editable) return true;
        throw new EditingDisabledError(reason ?? 'disabled');
    }
}
