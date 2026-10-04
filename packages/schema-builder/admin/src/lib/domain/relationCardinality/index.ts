import type { OwningRelationDoc } from '@orthacms/schema-builder-domain';

/** How many on each side, in the words the picker uses instead of three flags. */
export type Cardinality = 'manyToOne' | 'oneToOne' | 'manyToMany';

/** The flags a cardinality means. Each answer sets both, so switching never leaves one behind. */
export function toRelationFlags(
    cardinality: Cardinality
): Required<Pick<OwningRelationDoc, 'many' | 'unique'>> {
    switch (cardinality) {
        case 'manyToOne':
            return { many: false, unique: false };
        case 'oneToOne':
            return { many: false, unique: true };
        case 'manyToMany':
            return { many: true, unique: false };
    }
}

/** The cardinality a relation's flags mean. */
export function cardinalityOf(
    relation: Pick<OwningRelationDoc, 'many' | 'unique'>
): Cardinality {
    if (relation.many) return 'manyToMany';
    return relation.unique ? 'oneToOne' : 'manyToOne';
}
