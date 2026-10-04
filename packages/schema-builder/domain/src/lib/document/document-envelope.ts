import type { SchemaDocument } from './schema-document';

/** Why editing is off, when it is. */
export type ReadOnlyReason = 'production' | 'disabled' | 'no-source-tree';

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
