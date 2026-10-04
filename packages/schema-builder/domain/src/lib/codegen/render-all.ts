import type { SchemaDocument } from '../document/schema-document';
import { contentFilePath } from './module-path';
import { renderTypeModule } from './render-type-module';

/** Every builder-owned type's module, keyed by its path under `src/content/`. */
export function renderAll(document: SchemaDocument): Record<string, string> {
    const kinds = new Map(document.types.map((type) => [type.name, type.kind]));
    const kindOf = (name: string) => kinds.get(name) ?? 'collection';
    return Object.fromEntries(
        document.types
            .filter((type) => type.origin !== 'code')
            .map((type) => [
                contentFilePath(type.kind, type.name),
                renderTypeModule(type, kindOf)
            ])
    );
}
