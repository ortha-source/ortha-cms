import type {
    SerializedContentType,
    SerializedField
} from './content-type-registry';

/**
 * Whether a relation field of `type` stays in the schema even though its
 * target is unreachable: a **required owning single** relation on a
 * **non-publishable** type is a `NOT NULL` column, so no entry of the type can
 * be saved in this workspace at all. Dropping it would hide the one thing that
 * explains the 422 — the same exception `waivedRequiredRelations` makes.
 */
function isUnwaivableColumn(
    type: SerializedContentType,
    field: SerializedField
): boolean {
    const relation = field.relation;
    return (
        !!relation &&
        field.required &&
        !type.publishable &&
        !relation.many &&
        !relation.inverse
    );
}

/**
 * `type`'s serialized schema as one workspace sees it: without the relation
 * fields whose target type the workspace cannot reach (`reachable` — own
 * grants plus available shared ones, `ContentGrantsQuery.reachableSlugs`).
 *
 * The registry's schema is **global**, and served as is it describes fields
 * nobody in the workspace can fill: the admin hides them, the target type is
 * refused by every tool, and the server waives `required` on them
 * (`waivedRequiredRelations`). An agent reading the raw schema saw
 * `author: required` on an article whose author type the workspace was never
 * granted, concluded no draft could be saved without it, and refused the task
 * — while the save it refused would have gone through.
 *
 * Dropped rather than marked optional: the field is not something the caller
 * can set, so describing it at all invites a value the link write refuses.
 * The one exception is {@link isUnwaivableColumn}.
 */
export function scopeSerializedType(
    type: SerializedContentType,
    reachable: ReadonlySet<string>
): SerializedContentType {
    const fields = type.fields.filter(
        (field) =>
            !field.relation ||
            reachable.has(field.relation.to) ||
            isUnwaivableColumn(type, field)
    );
    return fields.length === type.fields.length ? type : { ...type, fields };
}
