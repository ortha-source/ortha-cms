import type { TypeDoc } from '../document/type-doc';

/**
 * The second argument of `collection()` / `single()`, minus `fields` (rendered
 * separately as raw source). Flags at their default are left out.
 */
export function renderTypeOptions(type: TypeDoc): Record<string, unknown> {
    return {
        label: type.label,
        description: type.description,
        ...(type.kind === 'single' ? { path: type.path } : {}),
        publishable: type.publishable || undefined,
        paranoid: type.paranoid || undefined,
        i18n: type.i18n || undefined,
        groups: type.groups.length
            ? Object.fromEntries(
                  type.groups.map(({ key, label, description, collapsed }) => [
                      key,
                      { label, description, collapsed: collapsed || undefined }
                  ])
              )
            : undefined
    };
}
