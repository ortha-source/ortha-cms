import { IsObject, IsOptional } from 'class-validator';
import type { RelationDelta } from '../types/entry-list-view';

/**
 * Body for `POST /api/content/:typeName` (create) and
 * `PATCH /api/content/:typeName/:id` (update). The field `values` bag crosses the
 * wire, plus optional per-field relation **deltas** (`relations`) — the editor
 * stages its many-to-many / inverse link changes locally and sends them here
 * with the rest of the document, so a save persists everything in **one
 * transaction** without ever transmitting a huge relation whole.
 *
 * Reserved envelope columns (`status`/`published_at`/`deleted_at`) are owned by
 * the service and can't be set from here: `toColumns` projects only keys
 * declared on the type, so a reserved (or otherwise unknown) key in the bag is
 * silently dropped before storage; on a non-publishable type
 * `EntryValidationService` additionally flags unknown keys as a 422. The bag's
 * *contents* are validated against the type's field specs by that same service
 * (a dynamic, per-type contract class-validator can't express); the relation
 * deltas' ids are validated as existing workspace entries by
 * `RelationLinkService`. So the only structural check here is "are they objects".
 */
export class SaveEntryDto {
    /** Field values keyed by field name. */
    @IsObject()
    values!: Record<string, unknown>;

    /**
     * Per-field relation deltas (`{ <field>: { link?, unlink?, order? } }`) —
     * many/inverse relations only; a single relation is set through `values`.
     */
    @IsOptional()
    @IsObject()
    relations?: Record<string, RelationDelta>;
}
