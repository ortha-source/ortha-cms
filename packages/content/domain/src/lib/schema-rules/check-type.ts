import { checkColumn } from './field-rules/check-column';
import { checkFieldWidth } from './field-rules/check-field-width';
import { checkLocaleSync } from './field-rules/check-locale-sync';
import { checkLocalized } from './field-rules/check-localized';
import { checkRelationUnique } from './field-rules/check-relation-unique';
import { checkRequiredSetNull } from './field-rules/check-required-set-null';
import { checkEmptyGroups } from './group-rules/check-empty-groups';
import { checkGroupKeys } from './group-rules/check-group-keys';
import { checkGroupRefs } from './group-rules/check-group-refs';
import type { FieldPass, FieldRule, TypeRule } from './rule';
import type { RuleType } from './rule-type';
import type { SchemaIssue } from './schema-issue';
import { checkHasFields } from './type-rules/check-has-fields';
import { checkSinglePath } from './type-rules/check-single-path';
import { checkTypeName } from './type-rules/check-type-name';

/** Whole-type rules that run before any field. */
export const TYPE_RULES: readonly TypeRule[] = [
    checkTypeName,
    checkSinglePath,
    checkHasFields
];

/** Run field by field, in declaration order: the first broken field is reported first. */
export const FIELD_RULES: readonly FieldRule[] = [
    checkLocalized,
    checkRelationUnique,
    checkLocaleSync,
    checkRequiredSetNull,
    checkColumn
];

/** A second field pass, after the first: layout. */
export const LAYOUT_RULES: readonly FieldRule[] = [checkFieldWidth];

/** The form's groups, once every field is known. */
export const GROUP_RULES: readonly TypeRule[] = [
    checkGroupKeys,
    checkGroupRefs,
    checkEmptyGroups
];

/**
 * Every rule the DSL applies when `collection()` / `single()` runs, in the
 * order it has always applied them — so the first issue is the boot error an
 * author would have seen before these rules moved here.
 */
export function checkType(type: RuleType): SchemaIssue[] {
    return [
        ...TYPE_RULES.flatMap((rule) => rule(type)),
        ...fieldPass(type, FIELD_RULES),
        ...fieldPass(type, LAYOUT_RULES),
        ...GROUP_RULES.flatMap((rule) => rule(type))
    ];
}

export function fieldPass(
    type: RuleType,
    rules: readonly FieldRule[]
): SchemaIssue[] {
    const pass: FieldPass = { columns: new Map() };
    return Object.entries(type.fields).flatMap(([name, field]) =>
        rules.flatMap((rule) => rule(type, name, field, pass))
    );
}
