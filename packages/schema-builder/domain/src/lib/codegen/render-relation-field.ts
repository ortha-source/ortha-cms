import type { RelationFieldDoc } from '../document/field-doc';
import { isInverseRelation } from '../document/relation-doc';
import { fieldOptions } from './field-options';
import { objectLiteral } from './object-literal';

/** A relation target as a thunk — annotated, which breaks import/type-inference cycles. */
export const relationThunk = (target: string): string =>
    `(): AnyContentType => ${target}`;

/** `field.relation({ to: () => author, … })` or `field.relationInverse({ of, field })`. */
export function renderRelationField(spec: RelationFieldDoc): string {
    if (isInverseRelation(spec)) {
        const options = {
            field: spec.inverseOf,
            ...(spec.many === false ? { many: false } : {}),
            ...fieldOptionsWithoutRelation(spec)
        };
        return `field.relationInverse(${objectLiteral(options, { raw: { of: relationThunk(spec.to) }, first: ['of', 'field'] })})`;
    }
    return `field.relation(${objectLiteral(fieldOptions(spec), { raw: { to: relationThunk(spec.to) }, first: ['to'] })})`;
}

/** Storage options an inverse does not have: it reuses the owning side's storage. */
const OWNING_ONLY = new Set([
    'many',
    'unique',
    'onDelete',
    'syncAcrossLocales'
]);

/** An inverse takes the base options (required, admin…) but none of the storage ones. */
function fieldOptionsWithoutRelation(
    spec: RelationFieldDoc
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(fieldOptions(spec)).filter(
            ([key]) => !OWNING_ONLY.has(key)
        )
    );
}
