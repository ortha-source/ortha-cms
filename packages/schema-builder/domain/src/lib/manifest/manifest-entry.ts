/** One content type as the manifest needs it. */
export interface ManifestEntry {
    /** Machine name — also the module's export name and file basename. */
    readonly name: string;
    readonly kind: 'collection' | 'single';
    /** Storage-owning many-relations, each of which has a join table. */
    readonly joinFields: readonly string[];
}

/** Where a type's module lives under `src/content/`, by its kind. */
export const contentFolder = (
    kind: ManifestEntry['kind']
): 'collections' | 'pages' => (kind === 'single' ? 'pages' : 'collections');
