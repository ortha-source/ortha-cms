import {
    checkFieldWidth,
    fieldPass,
    GROUP_RULES
} from '@orthacms/content-domain';
import type { AnyFieldSpec } from '../types/fields';
import type { FieldGroup, FieldGroupOptions } from '../types/content-type';
import { toRuleType } from './to-rule-type';

/**
 * Rejects an `admin.width` the admin would not understand. The admin reads an
 * unknown width as `full`, so a typo (`'halff'`) would otherwise pass boot and
 * quietly lay the form out as if it had never been written.
 *
 * The rule itself lives in the content kernel (`checkFieldWidth`); `collection()`
 * runs it through `assertType`, and this stays as the focused entry point.
 */
export function assertFieldWidths(
    typeName: string,
    fields: Record<string, AnyFieldSpec>
): void {
    const type = toRuleType(
        { name: typeName, kind: 'collection', i18n: false },
        fields
    );
    const [first] = fieldPass(type, [checkFieldWidth]);
    if (first) throw new Error(first.message);
}

/**
 * Normalizes a type's `groups` into ordered {@link FieldGroup}s and checks the
 * fields' `admin.group` references against them.
 *
 * Fails at **define time**, like every other schema mistake: a field naming a
 * group that does not exist would otherwise vanish from the form's sections
 * without a word, and a group no field joins would render as an empty fold.
 * The checks are the kernel's `GROUP_RULES`.
 */
export function normalizeGroups(
    typeName: string,
    groups: Record<string, FieldGroupOptions> | undefined,
    fields: Record<string, AnyFieldSpec>
): FieldGroup[] {
    const type = toRuleType(
        { name: typeName, kind: 'collection', i18n: false, groups },
        fields
    );
    const [first] = GROUP_RULES.flatMap((rule) => rule(type));
    if (first) throw new Error(first.message);
    return toFieldGroups(groups);
}

/** A type's declared groups as ordered {@link FieldGroup}s — no checks. */
export function toFieldGroups(
    groups: Record<string, FieldGroupOptions> | undefined
): FieldGroup[] {
    return Object.entries(groups ?? {}).map(([key, options]) => ({
        key,
        label: options.label,
        ...(options.description ? { description: options.description } : {}),
        collapsed: options.collapsed ?? false
    }));
}
