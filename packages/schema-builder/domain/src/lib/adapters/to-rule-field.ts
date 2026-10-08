import type { FieldValidationRules, RuleField } from '@orthacms/content-domain';
import type { FieldDoc } from '../document/field-doc';
import { toRuleRelation } from './to-rule-relation';

/** The document keys that are value rules — what a default must also satisfy. */
const RULE_KEYS = [
    'minLength',
    'maxLength',
    'pattern',
    'min',
    'max',
    'integer'
] as const;

/** A default, with what it is checked against: the options and the value rules. */
function defaultValueFacts(spec: FieldDoc): Partial<RuleField> {
    const doc = spec as unknown as Record<string, unknown>;
    const validation = Object.fromEntries(
        RULE_KEYS.filter((key) => doc[key] !== undefined).map((key) => [
            key,
            doc[key]
        ])
    ) as FieldValidationRules;
    return {
        defaultValue: doc['defaultValue'],
        ...(Array.isArray(doc['options'])
            ? { options: doc['options'] as string[] }
            : {}),
        // Money is minor units: the DSL fixes `integer`, the document omits it.
        validation:
            spec.type === 'money'
                ? { ...validation, integer: true }
                : validation
    };
}

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
        ...('defaultValue' in spec && spec.defaultValue !== undefined
            ? defaultValueFacts(spec)
            : {}),
        ...(spec.admin?.width !== undefined ? { width: spec.admin.width } : {}),
        ...(spec.admin?.group !== undefined ? { group: spec.admin.group } : {}),
        ...(spec.type === 'relation' ? { relation: toRuleRelation(spec) } : {})
    };
}
