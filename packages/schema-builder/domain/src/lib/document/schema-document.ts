import type { TypeDoc } from './type-doc';

export const SCHEMA_DOCUMENT_VERSION = 1 as const;

/** The whole content model as the builder edits it. */
export interface SchemaDocument {
    version: typeof SCHEMA_DOCUMENT_VERSION;
    types: TypeDoc[];
}
