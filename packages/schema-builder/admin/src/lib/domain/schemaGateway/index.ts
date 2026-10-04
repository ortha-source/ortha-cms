import type {
    ApplyAccepted,
    ApplyOperation,
    SchemaDocument,
    SchemaDocumentEnvelope,
    SchemaPlan
} from '@orthacms/schema-builder-domain';

/** What an apply sends. Destructive changes are confirmed one by one, by id. */
export type ApplySchemaInput = {
    readonly document: SchemaDocument;
    readonly baseFingerprint: string;
    readonly migrationName: string;
    readonly confirmed: readonly string[];
};

/**
 * The port the application layer talks to; only `infrastructure/` knows it is
 * HTTP. Every method normalises failures into an `ApiError`.
 */
export type SchemaGateway = {
    /** The content model the running server serves, via `GET /api/schema-builder/document`. */
    document(): Promise<SchemaDocumentEnvelope>;
    /** What an apply would do, via `POST /api/schema-builder/plan`. */
    plan(
        document: SchemaDocument,
        baseFingerprint: string
    ): Promise<SchemaPlan>;
    /** Starts an apply, via `POST /api/schema-builder/apply`. */
    apply(input: ApplySchemaInput): Promise<ApplyAccepted>;
    /** Where an apply stands, via `GET /api/schema-builder/operations/:id`. */
    operation(id: string): Promise<ApplyOperation>;
    /** Grants a type to a workspace, via `POST /api/workspaces/:id/content`. */
    grant(workspaceId: string, slug: string): Promise<void>;
};
