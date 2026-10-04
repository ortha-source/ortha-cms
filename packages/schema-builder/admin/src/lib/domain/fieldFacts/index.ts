import {
    isInverseRelation,
    type FieldDoc
} from '@orthacms/schema-builder-domain';
import { cardinalityOf, type Cardinality } from '../relationCardinality';

/** One thing worth saying about a field in its row, formatted by the view. */
export type FieldFact =
    | { kind: 'required' }
    | { kind: 'localized' }
    | { kind: 'hidden' }
    | {
          kind: 'target';
          to: string;
          many: boolean;
          /** The owning side's cardinality; an inverse only mirrors one. */
          cardinality?: Cardinality;
          inverseOf?: string;
      }
    | { kind: 'options'; count: number }
    | { kind: 'multiple' };

/** The target and cardinality of a relation, as the row shows them. */
function relationFact(
    spec: Extract<FieldDoc, { type: 'relation' }>
): FieldFact {
    if (isInverseRelation(spec)) {
        return {
            kind: 'target',
            to: spec.to,
            many: spec.many ?? true,
            inverseOf: spec.inverseOf
        };
    }
    return {
        kind: 'target',
        to: spec.to,
        many: spec.many ?? false,
        cardinality: cardinalityOf(spec)
    };
}

/** What a field row says besides its name and type, in a fixed order. */
export function fieldFacts(spec: FieldDoc): FieldFact[] {
    const facts: FieldFact[] = [];
    if (spec.required) facts.push({ kind: 'required' });
    if (spec.localized) facts.push({ kind: 'localized' });
    if (spec.type === 'relation') facts.push(relationFact(spec));
    if (spec.type === 'select' || spec.type === 'multiselect')
        facts.push({ kind: 'options', count: spec.options.length });
    if (spec.type === 'media' && spec.multiple)
        facts.push({ kind: 'multiple' });
    if (spec.admin?.hidden) facts.push({ kind: 'hidden' });
    return facts;
}
