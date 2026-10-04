import type { FieldAdminDoc, FieldDoc } from '@orthacms/schema-builder-domain';

/** A value that means "not set" — an emptied input clears the option rather than storing `''`. */
const unset = (value: unknown): boolean =>
    value === undefined ||
    value === '' ||
    (typeof value === 'number' && Number.isNaN(value));

/** `record` with `patch` applied and every unset value removed. */
function merged<T extends object>(record: T, patch: Partial<T>): T {
    const next: Record<string, unknown> = { ...record, ...patch };
    for (const key of Object.keys(next)) if (unset(next[key])) delete next[key];
    return next as T;
}

/** A field's options with `patch` applied; an option set to nothing is dropped, so it stays the DSL default. */
export function patchSpec(
    spec: FieldDoc,
    patch: Partial<Record<string, unknown>>
): FieldDoc {
    return merged(
        spec as unknown as Record<string, unknown>,
        patch
    ) as unknown as FieldDoc;
}

/** A field's display options with `patch` applied; an empty `admin` is left out altogether. Unknown keys survive. */
export function patchAdmin(
    spec: FieldDoc,
    patch: Partial<FieldAdminDoc>
): FieldDoc {
    const admin = merged(spec.admin ?? {}, patch);
    const next = { ...spec, admin };
    if (Object.keys(admin).length === 0)
        delete (next as { admin?: FieldAdminDoc }).admin;
    return next;
}
