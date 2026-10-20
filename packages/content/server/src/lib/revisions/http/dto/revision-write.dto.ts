import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * The optional body of a version **restore** and a **publish-a-version** —
 * both re-apply a snapshot through the ordinary save, so both can reach a
 * record's other locales, and the editor asks about that the same way it does
 * for a save. See `SaveEntryDto` for the two flags.
 */
export class RevisionWriteDto {
    @ApiPropertyOptional({
        type: Boolean,
        description:
            'Ask first: refuse with a 422 `code: "content.sibling_sync_unconfirmed"` describing every other live row re-applying this version would change, and write nothing. As on a save.'
    })
    @IsOptional()
    @IsBoolean()
    askBeforeSiblingSync?: boolean;

    @ApiPropertyOptional({
        type: Boolean,
        description:
            'Confirm re-applying a version that leaves another published row failing validation. As on a save.'
    })
    @IsOptional()
    @IsBoolean()
    allowInvalidSiblings?: boolean;
}
