import type { ManifestEntry } from '@orthacms/schema-builder-domain';

/** What `content sync` needs to see on an imported content type. */
interface LoadedType {
    kind?: unknown;
    fields?: Record<
        string,
        { relation?: { many?: boolean; inverse?: unknown } }
    >;
}

export type ReadResult = { entry: ManifestEntry } | { problem: string };

/**
 * One imported module → its manifest entry, or the reason it cannot be one.
 * The convention is the whole contract: `collections/<name>.ts` exports a
 * collection named `<name>`, `pages/<name>.ts` a single. Anything else is
 * reported rather than guessed at.
 */
export function readManifestEntry(
    folder: 'collections' | 'pages',
    file: string,
    mod: Record<string, unknown>
): ReadResult {
    const name = file.replace(/\.ts$/, '');
    const type = mod[name] as LoadedType | undefined;
    if (
        !type ||
        (type.kind !== 'collection' && type.kind !== 'single') ||
        !type.fields
    ) {
        return {
            problem: `${folder}/${file} does not export a content type named "${name}".`
        };
    }
    const expected = folder === 'pages' ? 'single' : 'collection';
    if (type.kind !== expected) {
        return {
            problem: `${folder}/${file} declares a ${type.kind}; move it to ${type.kind === 'single' ? 'pages' : 'collections'}/.`
        };
    }
    const joinFields = Object.entries(type.fields)
        .filter(([, spec]) => spec.relation?.many && !spec.relation.inverse)
        .map(([field]) => field);
    return { entry: { name, kind: type.kind, joinFields } };
}
