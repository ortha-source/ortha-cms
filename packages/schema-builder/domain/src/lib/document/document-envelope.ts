import type { SchemaDocument } from './schema-document';

/**
 * Why editing is off, when it is: production, the flag, no `src/content/`
 * on disk, or a content manifest written by hand (the builder rewrites it on
 * every apply, so it has to own it).
 */
export type ReadOnlyReason =
    | 'production'
    | 'disabled'
    | 'no-source-tree'
    | 'hand-written-manifest';

export interface BuilderCapabilities {
    editable: boolean;
    reason?: ReadOnlyReason;
    /** `watch` — the server restarts itself after an apply; `manual` — the user restarts it. */
    restart: 'watch' | 'manual';
}

/** What `GET /schema-builder/document` answers. */
export interface SchemaDocumentEnvelope {
    document: SchemaDocument;
    /** Hash of the document as served — the optimistic-concurrency token. */
    fingerprint: string;
    /** New per server process; a changed value means a restart has landed. */
    bootId: string;
    capabilities: BuilderCapabilities;
}
