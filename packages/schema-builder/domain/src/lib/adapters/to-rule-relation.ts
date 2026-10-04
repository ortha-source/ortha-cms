import type { RuleRelation } from '@orthacms/content-domain';
import type { RelationFieldDoc } from '../document/field-doc';
import { isInverseRelation } from '../document/relation-doc';

/**
 * A relation with the DSL's defaults filled in — the same defaults
 * `field.relation()` / `field.relationInverse()` apply, so a rule sees what the
 * DSL would normalize the declaration to.
 */
export function toRuleRelation(spec: RelationFieldDoc): RuleRelation {
    if (isInverseRelation(spec)) {
        return {
            to: spec.to,
            many: spec.many ?? true,
            unique: false,
            onDelete: 'set null',
            syncAcrossLocales: false,
            inverse: { field: spec.inverseOf }
        };
    }
    return {
        to: spec.to,
        many: spec.many ?? false,
        unique: spec.unique ?? false,
        onDelete: spec.onDelete ?? (spec.required ? 'cascade' : 'set null'),
        syncAcrossLocales: spec.syncAcrossLocales ?? !spec.localized
    };
}
