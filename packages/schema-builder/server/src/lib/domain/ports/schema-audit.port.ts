/** What an apply did, for the audit trail. */
export interface SchemaAppliedFacts {
    readonly operationId: string;
    readonly actorId: string | null;
    readonly changes: readonly string[];
    readonly migrations: readonly string[];
    readonly files: readonly string[];
}

/** Records `schema.applied` — through the outbox, like every other domain event. */
export interface SchemaAudit {
    applied(facts: SchemaAppliedFacts): Promise<void>;
}
