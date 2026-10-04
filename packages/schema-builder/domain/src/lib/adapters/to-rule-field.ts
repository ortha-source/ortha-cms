import type { RuleField } from '@orthacms/content-domain';
import type { FieldDoc } from '../document/field-doc';
import { toRuleRelation } from './to-rule-relation';

/** One field as the kernel's schema rules see it. */
export function toRuleField(spec: FieldDoc): RuleField {
    return {
        type: spec.type,
        required: spec.required ?? false,
        ...(spec.localized ? { localized: true } : {}),
        ...(spec.lang !== undefined ? { lang: spec.lang } : {}),
        ...(spec.type === 'text' && spec.pattern !== undefined
            ? { pattern: spec.pattern }
            : {}),
        ...(spec.type === 'media' && spec.accept
            ? { accept: spec.accept }
            : {}),
        ...(spec.admin?.width !== undefined ? { width: spec.admin.width } : {}),
        ...(spec.admin?.group !== undefined ? { group: spec.admin.group } : {}),
        ...(spec.type === 'relation' ? { relation: toRuleRelation(spec) } : {})
    };
}
