import {
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength
} from 'class-validator';
import type { RelationDelta } from '../types/entry-list-view';
import { IsRelationDeltaMap } from './relation-delta-map.validator';

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
 * `RelationLinkService`. `values` is structurally only "an object" (its contents
 * are the per-type contract); the `relations` bag's *shape* — each value a
 * `{ link?, unlink?, order? }` of uuid arrays — is enforced here so a malformed
 * delta is a clean 400, not a 500 from a bad id hitting the query.
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
    @IsRelationDeltaMap()
    relations?: Record<string, RelationDelta>;

    /**
     * Locale slug the entry is created in — an **extension-owned** param this
     * package declares but never interprets (forwarded to the bound
     * `CONTENT_ENTRY_EXTENSION`, which validates it and stamps the envelope
     * column). Read on create only; an update never re-homes a row's locale.
     */
    @IsOptional()
    @IsString()
    @MaxLength(35)
    locale?: string;

    /**
     * The existing translation group a created row joins (making it a sibling)
     * — an **extension-owned**, opaque param, like {@link locale}. Absent → the
     * row starts its own fresh group. The bound extension validates it against
     * the workspace. Read on create only.
     */
    @IsOptional()
    @IsUUID()
    localeGroupId?: string;
}
