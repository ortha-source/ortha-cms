import type { SchemaDocumentEnvelope } from '@orthacms/schema-builder-domain';

/**
 * The port the application layer talks to; only `infrastructure/` knows it is
 * HTTP. Grows a `plan` and an `apply` with the editor.
 */
export type SchemaGateway = {
    /** The content model the running server serves, via `GET /api/schema-builder/document`. */
    document(): Promise<SchemaDocumentEnvelope>;
};
