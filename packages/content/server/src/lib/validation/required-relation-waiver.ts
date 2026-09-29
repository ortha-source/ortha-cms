import { CONTENT_FIELD_TYPE } from '../types/fields';
import type { AnyContentType } from '../types/content-type';

/**
 * Whether `type` has at least one required relation — the only fields a
 * waiver can ever name, so a type without one never needs the grants read.
 */
export function hasRequiredRelation(type: AnyContentType): boolean {
    return Object.values(type.fields).some(
        (spec) =>
            spec.type === CONTENT_FIELD_TYPE.Relation &&
            !!spec.relation &&
            spec.required
    );
}

/**
 * The required relations of `type` whose `required` flag does not apply in a
 * workspace holding the content grants `granted`.
 *
 * A relation is **reachable** from a workspace when the workspace holds a
 * `workspace_content` grant for its target type — the same condition that
 * decides whether it may read that type, link to it, or see a shared
 * workspace's rows of it (ADR-0019). An unreachable target is one nobody in the
 * workspace can pick: the admin hides the field, the public API and the agent
 * tools refuse the type. Requiring a value there would make every entry of the
 * owning type unsaveable (on a live type) and unpublishable (on a publishable
 * one) in that workspace, so the requirement is waived instead. A value that
 * is supplied anyway is still validated and still held to the target's own
 * rules — the waiver removes `is required`, nothing else.
 *
 * One exception, forced by the storage: on a **non-publishable** type a
 * required owning single relation is a `NOT NULL` foreign key (see
 * `table-builder.ts`), so an empty value cannot be stored at all. It is never
 * waived; the caller keeps getting the honest 422 rather than a constraint
 * violation. A publishable type's columns are nullable (required means
 * required *to publish*), and a link-managed relation owns no column, so both
 * are waived.
 */
export function waivedRequiredRelations(
    type: AnyContentType,
    granted: ReadonlySet<string>
): Set<string> {
    const waived = new Set<string>();
    for (const [name, spec] of Object.entries(type.fields)) {
        const relation = spec.relation;
        if (
            spec.type !== CONTENT_FIELD_TYPE.Relation ||
            !relation ||
            !spec.required
        )
            continue;
        const notNullColumn =
            !type.publishable && !relation.many && !relation.inverse;
        if (notNullColumn) continue;
        if (!granted.has(relation.to().name)) waived.add(name);
    }
    return waived;
}
