import {
    contentFilePath,
    isGeneratedSource,
    type TypeOrigin
} from '@orthacms/schema-builder-domain';
import type { SourceTree } from '../../domain/ports/source-tree.port';

/**
 * Who owns a type's file: the builder when its first line carries the marker,
 * the author otherwise — including when there is no file at the conventional
 * path at all, which the builder cannot rewrite either.
 */
export async function readOrigin(
    tree: SourceTree,
    contentDir: string,
    type: { name: string; kind: 'collection' | 'single' }
): Promise<TypeOrigin> {
    const first = await tree.firstLine(
        `${contentDir}/${contentFilePath(type.kind, type.name)}`
    );
    return isGeneratedSource(first) ? 'builder' : 'code';
}
