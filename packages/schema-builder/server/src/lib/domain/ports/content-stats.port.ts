import type {
    ChangeFacts,
    SchemaChange,
    SchemaDocument
} from '@orthacms/schema-builder-domain';

/** The database facts classification needs, read once per plan. */
export interface ContentStats {
    /** Facts about the types `changes` touch, against the document they lead to. */
    facts(
        changes: readonly SchemaChange[],
        after: SchemaDocument
    ): Promise<ChangeFacts>;
}
