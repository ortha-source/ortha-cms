/**
 * Query keys for the schema builder's cache. The document is one key: it is
 * global (types are code, the same in every workspace) and changes only when
 * the server restarts.
 */
export const schemaKeys = {
    /** Root key covering every schema builder query. */
    all: ['schema-builder'] as const,
    /** The document envelope. */
    document: () => ['schema-builder', 'document'] as const
};
