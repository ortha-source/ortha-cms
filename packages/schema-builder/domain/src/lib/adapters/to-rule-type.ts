import type { RuleType } from '@orthacms/content-domain';
import type { TypeDoc } from '../document/type-doc';
import { toRuleField } from './to-rule-field';

/**
 * A type from the builder's document as the kernel's schema rules see it, so
 * `checkTypes(document.types.map(toRuleType))` is the same verdict the DSL and
 * the registry would reach at boot.
 */
export function toRuleType(type: TypeDoc): RuleType {
    return {
        name: type.name,
        kind: type.kind,
        ...(type.path !== undefined ? { path: type.path } : {}),
        i18n: type.i18n,
        fields: Object.fromEntries(
            type.fields.map((field) => [field.name, toRuleField(field.spec)])
        ),
        ...(type.groups.length
            ? {
                  groups: Object.fromEntries(
                      type.groups.map((group) => [
                          group.key,
                          { label: group.label }
                      ])
                  )
              }
            : {})
    };
}
