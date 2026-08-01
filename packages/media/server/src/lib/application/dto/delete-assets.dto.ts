import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

/** Max assets one bulk delete may target. */
const MAX_DELETE_IDS = 100;

/** The body for a bulk asset delete — a non-empty, bounded list of ids. */
export class DeleteAssetsDto {
    /** Asset ids to delete, together with their stored blobs. */
    @ApiProperty({
        type: [String],
        format: 'uuid',
        minItems: 1,
        maxItems: MAX_DELETE_IDS,
        example: ['6b2f9a03-4c17-4e58-a3d9-77c0e1b48f52'],
        description: `Asset ids to delete. Non-empty and capped at ${MAX_DELETE_IDS}; the rows go in one transaction and their blobs (originals + derivatives) are reclaimed post-commit.`
    })
    @IsArray()
    @ArrayNotEmpty()
    @ArrayMaxSize(MAX_DELETE_IDS)
    @IsUUID('all', { each: true })
    ids!: string[];
}
