/**
 * What a broken schema rule reports. The DSL throws the first issue's `message`
 * verbatim, so the messages here are the boot errors authors already know; the
 * schema builder shows every issue at its `path` while the author types.
 */
export type SchemaIssueCode =
    | 'type.name'
    | 'type.single-path'
    | 'type.no-fields'
    | 'type.duplicate'
    | 'field.localized-without-i18n'
    | 'field.reserved-column'
    | 'field.column-collision'
    | 'field.width'
    | 'field.lang'
    | 'field.pattern'
    | 'field.media-kind'
    | 'field.default-value'
    | 'relation.unique-many'
    | 'relation.sync-without-i18n'
    | 'relation.localized-sync'
    | 'relation.required-set-null'
    | 'relation.unknown-target'
    | 'relation.inverse-not-owning'
    | 'relation.inverse-mismatch'
    | 'group.key'
    | 'group.label'
    | 'group.unknown'
    | 'group.empty';

export interface SchemaIssue {
    /** Where in the schema: `article`, `article.fields.title`, `article.groups.seo`. */
    readonly path: string;
    readonly code: SchemaIssueCode;
    readonly message: string;
}

/** The one constructor every rule reports through. */
export function issue(
    path: string,
    code: SchemaIssueCode,
    message: string
): SchemaIssue {
    return { path, code, message };
}

export const typePath = (type: string) => type;
export const fieldPath = (type: string, field: string) =>
    `${type}.fields.${field}`;
export const groupPath = (type: string, group: string) =>
    `${type}.groups.${group}`;
