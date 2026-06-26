import { IsObject } from 'class-validator';

/**
 * Body for `POST /api/content/:typeName` (create) and
 * `PATCH /api/content/:typeName/:id` (update). Only the field `values` bag
 * crosses the wire; reserved envelope columns (`status`/`published_at`/
 * `deleted_at`) are owned by the service and rejected by validation if a client
 * tries to set them. The bag's *contents* are validated against the type's field
 * specs by `EntryValidationService` (a dynamic, per-type contract class-validator
 * can't express), so the only structural check here is "is an object".
 */
export class SaveEntryDto {
    /** Field values keyed by field name. */
    @IsObject()
    values!: Record<string, unknown>;
}
