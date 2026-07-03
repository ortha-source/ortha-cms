import { IsArray, IsOptional, IsString } from 'class-validator';

/**
 * Body for `POST /api/content/:typeName/:id/relations/:field` — an incremental
 * change to one many/inverse relation field. Only the diff crosses the wire, so
 * a relation with thousands of links is never sent whole. Every array is
 * optional (a body may link only, unlink only, or just reorder); the ids
 * themselves are validated as existing workspace entries by the service (a
 * dynamic, per-target check class-validator can't express).
 */
export class RelationDeltaDto {
    /** Target ids to link (append). */
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    link?: string[];

    /** Target ids to unlink. */
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    unlink?: string[];

    /** Desired order of the listed target ids (owning many-relations only). */
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    order?: string[];
}
