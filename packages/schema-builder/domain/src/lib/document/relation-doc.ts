/** The owning side of a relation: it holds the FK column or the join table. */
export interface OwningRelationDoc {
    /** The target type's machine name. */
    to: string;
    many?: boolean;
    unique?: boolean;
    onDelete?: 'cascade' | 'set null' | 'restrict';
    syncAcrossLocales?: boolean;
}

/** The mirror side (`field.relationInverse`): no storage, it reads `to.<inverseOf>`. */
export interface InverseRelationDoc {
    /** The owning type. */
    to: string;
    /** The owning relation field on `to`. */
    inverseOf: string;
    /** Defaults to `true`, like the DSL. */
    many?: boolean;
}

export type RelationDoc = OwningRelationDoc | InverseRelationDoc;

export const isInverseRelation = (
    relation: RelationDoc
): relation is InverseRelationDoc =>
    'inverseOf' in relation && typeof relation.inverseOf === 'string';
