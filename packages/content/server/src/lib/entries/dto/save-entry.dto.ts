import { IsObject } from 'class-validator';

/**
 * Body for `POST /api/content/:typeName` (create) and
 * `PATCH /api/content/:typeName/:id` (update). Only the field `values` bag
 * crosses the wire. Reserved envelope columns (`status`/`published_at`/
 * `deleted_at`) are owned by the service and can't be set from here: `toColumns`
 * projects only keys declared on the type, so a reserved (or otherwise unknown)
 * key in the bag is silently dropped before storage; on a non-publishable type
 * `EntryValidationService` additionally flags unknown keys as a 422. The bag's
 * *contents* are validated against the type's field specs by that same service
 * (a dynamic, per-type contract class-validator can't express), so the only
 * structural check here is "is an object".
 */
export class SaveEntryDto {
    /** Field values keyed by field name. */
    @IsObject()
    values!: Record<string, unknown>;
}
