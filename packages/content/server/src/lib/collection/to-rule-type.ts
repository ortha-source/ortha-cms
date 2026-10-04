import type { RuleField, RuleType } from '@orthacms/content-domain';
import type { FieldGroupOptions } from '../types/content-type';
import type { AnyFieldSpec } from '../types/fields';

/** The parts of a declaration the schema rules read besides its fields. */
export interface RuleTypeHead {
    readonly name: string;
    readonly kind: 'collection' | 'single';
    readonly path?: string;
    readonly i18n: boolean;
    readonly groups?: Readonly<Record<string, FieldGroupOptions>>;
}

/**
 * A DSL declaration as the kernel's schema rules see it.
 *
 * A relation's target is a **getter**, not a value: `collection()` runs while
 * its module is still being imported, and resolving a thunk then would hit the
 * next file's temporal dead zone. Only the set rules read `to`, and only the
 * registry runs those — after every type has been imported.
 */
export function toRuleType(
    head: RuleTypeHead,
    fields: Readonly<Record<string, AnyFieldSpec>>
): RuleType {
    return {
        name: head.name,
        kind: head.kind,
        ...(head.path !== undefined ? { path: head.path } : {}),
        i18n: head.i18n,
        fields: Object.fromEntries(
            Object.entries(fields).map(([name, spec]) => [
                name,
                toRuleField(spec)
            ])
        ),
        ...(head.groups ? { groups: head.groups } : {})
    };
}

export function toRuleField(spec: AnyFieldSpec): RuleField {
    const relation = spec.relation;
    return {
        type: spec.type,
        required: spec.required,
        ...(spec.localized ? { localized: true } : {}),
        ...(spec.lang !== undefined ? { lang: spec.lang } : {}),
        ...(spec.validation.pattern !== undefined
            ? { pattern: spec.validation.pattern }
            : {}),
        ...(spec.accept ? { accept: spec.accept } : {}),
        ...(spec.admin.width !== undefined ? { width: spec.admin.width } : {}),
        ...(spec.admin.group !== undefined ? { group: spec.admin.group } : {}),
        ...(relation
            ? {
                  relation: {
                      get to() {
                          return relation.to().name;
                      },
                      many: relation.many,
                      unique: relation.unique,
                      onDelete: relation.onDelete,
                      syncAcrossLocales: relation.syncAcrossLocales,
                      ...(relation.inverse
                          ? { inverse: { field: relation.inverse.field } }
                          : {})
                  }
              }
            : {})
    };
}
