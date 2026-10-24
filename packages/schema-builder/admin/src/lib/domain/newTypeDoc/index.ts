import type { FieldEntry, TypeDoc } from '@orthacms/schema-builder-domain';

/** What the "New content type" dialog decides beyond name and kind. */
export type NewTypeOptions = {
    publishable?: boolean;
    paranoid?: boolean;
    i18n?: boolean;
    /** The fields a template starts the type with. */
    fields?: FieldEntry[];
};

/**
 * A type that does not exist yet: no fields unless a template gave some —
 * the editor greets an empty one with a state that leads to the first — and
 * the DSL's defaults for the flags unless the dialog chose others. The schema
 * refuses a type with no fields, so until one is added the draft carries
 * that issue and cannot be reviewed.
 */
export function newTypeDoc(
    name: string,
    label: string,
    kind: TypeDoc['kind'],
    options: NewTypeOptions = {}
): TypeDoc {
    return {
        name,
        kind,
        ...(kind === 'single' ? { path: `/${name.replace(/_/g, '-')}` } : {}),
        ...(label && label !== name ? { label } : {}),
        publishable: options.publishable ?? true,
        paranoid: options.paranoid ?? false,
        i18n: options.i18n ?? false,
        groups: [],
        fields: options.fields ?? [],
        origin: 'new'
    };
}
