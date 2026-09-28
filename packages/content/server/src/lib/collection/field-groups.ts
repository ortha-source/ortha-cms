import type { AnyFieldSpec } from '../types/fields';
import type { FieldGroup, FieldGroupOptions } from '../types/content-type';

/** The widths `admin.width` accepts. */
const FIELD_WIDTHS: ReadonlySet<unknown> = new Set(['half', 'full']);

/**
 * Rejects an `admin.width` the admin would not understand. The admin reads an
 * unknown width as `full`, so a typo (`'halff'`) would otherwise pass boot and
 * quietly lay the form out as if it had never been written.
 */
export function assertFieldWidths(
    typeName: string,
    fields: Record<string, AnyFieldSpec>
): void {
    for (const [fieldName, spec] of Object.entries(fields)) {
        const width = spec.admin.width;
        if (width !== undefined && !FIELD_WIDTHS.has(width)) {
            throw new Error(
                `Field "${typeName}.${fieldName}" has admin.width ` +
                    `"${String(width)}" — use 'half' or 'full'.`
            );
        }
    }
}

/** Valid group keys: the same shape as a field name. */
const GROUP_KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/;

/**
 * Normalizes a type's `groups` into ordered {@link FieldGroup}s and checks the
 * fields' `admin.group` references against them.
 *
 * Fails at **define time**, like every other schema mistake: a field naming a
 * group that does not exist would otherwise vanish from the form's sections
 * without a word, and a group no field joins would render as an empty fold.
 */
export function normalizeGroups(
    typeName: string,
    groups: Record<string, FieldGroupOptions> | undefined,
    fields: Record<string, AnyFieldSpec>
): FieldGroup[] {
    const entries = Object.entries(groups ?? {});
    for (const [key, options] of entries) {
        if (!GROUP_KEY_RE.test(key)) {
            throw new Error(
                `Group "${typeName}.${key}" must be an identifier ` +
                    `(letters, digits, underscores; starting with a letter).`
            );
        }
        if (typeof options.label !== 'string' || !options.label.trim()) {
            throw new Error(`Group "${typeName}.${key}" needs a label.`);
        }
    }

    const keys = new Set(entries.map(([key]) => key));
    const used = new Set<string>();
    for (const [fieldName, spec] of Object.entries(fields)) {
        const group = spec.admin.group;
        if (group === undefined) continue;
        if (typeof group !== 'string' || !keys.has(group)) {
            throw new Error(
                `Field "${typeName}.${fieldName}" names group ` +
                    `"${String(group)}", which "${typeName}" does not declare.`
            );
        }
        used.add(group);
    }

    for (const key of keys) {
        if (!used.has(key)) {
            throw new Error(
                `Group "${typeName}.${key}" has no fields — ` +
                    `set admin.group on at least one field, or remove it.`
            );
        }
    }

    return entries.map(([key, options]) => ({
        key,
        label: options.label,
        ...(options.description ? { description: options.description } : {}),
        collapsed: options.collapsed ?? false
    }));
}
