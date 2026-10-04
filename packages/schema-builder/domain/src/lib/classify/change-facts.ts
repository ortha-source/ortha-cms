import type { SchemaDocument } from '../document/schema-document';

/** Facts only the server knows. The domain asks; it never queries. */
export interface ChangeFacts {
    /** Live rows of a type, trash included. */
    rows(type: string): number;
    /** Workspaces holding any grant of a type. */
    grantedTo(type: string): number;
    /** Other types with a relation to this one, in the document being applied. */
    referencedBy(type: string): readonly string[];
}

export interface ClassifyContext {
    /** The document the change leads to. */
    readonly after: SchemaDocument;
    readonly facts: ChangeFacts;
}

/** Whether a type in `after` is live (no draft/publish), where `required` means NOT NULL. */
export const isLiveType = (ctx: ClassifyContext, type: string): boolean =>
    !ctx.after.types.find((candidate) => candidate.name === type)?.publishable;
