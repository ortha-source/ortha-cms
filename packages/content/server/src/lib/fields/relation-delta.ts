import type { AnyFieldSpec } from '../types/fields';

/**
 * Whether a save may carry a relation delta (`relations.<field>`) for this
 * field — i.e. whether this side owns writable, join-backed links.
 *
 * True for an owning many-to-many and for the inverse of one (it reuses the
 * owning join table). False for a single relation (set through `values`) and
 * for the inverse of a single relation (one-to-many): its links are the
 * owners' FK columns, so they can only be changed on the owning side.
 *
 * One test, two readers: the writer refuses a delta it fails, and the schema
 * serializer reports it as `inverse.writable` so the admin never offers an
 * edit the writer would refuse.
 */
export function acceptsRelationDelta(spec: AnyFieldSpec | undefined): boolean {
    const rel = spec?.relation;
    if (!rel) return false;
    return rel.inverse
        ? !!rel.to().fields[rel.inverse.field]?.relation?.many
        : !!rel.many;
}
