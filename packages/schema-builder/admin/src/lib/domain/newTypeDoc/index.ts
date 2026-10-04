import type { TypeDoc } from '@orthacms/schema-builder-domain';

/**
 * A type that does not exist yet: no fields — the editor greets it with an
 * empty state that leads to the first one — and the DSL's defaults for the
 * flags. The schema refuses a type with no fields, so until one is added the
 * draft carries that issue and cannot be reviewed.
 */
export function newTypeDoc(
    name: string,
    label: string,
    kind: TypeDoc['kind']
): TypeDoc {
    return {
        name,
        kind,
        ...(kind === 'single' ? { path: `/${name.replace(/_/g, '-')}` } : {}),
        ...(label && label !== name ? { label } : {}),
        publishable: true,
        paranoid: false,
        i18n: false,
        groups: [],
        fields: [],
        origin: 'new'
    };
}
