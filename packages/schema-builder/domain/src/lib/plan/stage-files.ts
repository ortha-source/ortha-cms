import { contentFilePath } from '../codegen/module-path';
import { renderAll } from '../codegen/render-all';
import type { SchemaDocument } from '../document/schema-document';
import { renderManifest } from '../manifest/render-manifest';
import { toManifest } from '../manifest/to-manifest';

/** What writing a document into `src/content/` means, file by file. */
export interface StageFiles {
    /** Path under `src/content/` → full source (not yet formatted). */
    readonly write: Readonly<Record<string, string>>;
    /** Paths under `src/content/` to delete. */
    readonly remove: readonly string[];
}

/**
 * The files that turn `current` into `next`: every type the builder owns,
 * the manifest, and the file of every builder-owned type that is gone.
 * Hand-written files are never in either list.
 */
export function stageFiles(
    current: SchemaDocument,
    next: SchemaDocument
): StageFiles {
    const kept = new Set(next.types.map((type) => type.name));
    return {
        write: {
            ...renderAll(next),
            'index.ts': renderManifest(toManifest(next))
        },
        remove: current.types
            .filter((type) => type.origin === 'builder' && !kept.has(type.name))
            .map((type) => contentFilePath(type.kind, type.name))
    };
}
