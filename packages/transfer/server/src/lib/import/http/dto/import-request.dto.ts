import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
    CONFLICT_POLICIES,
    CONFLICT_POLICY,
    type ConflictPolicy
} from '@orthacms/transfer-domain';

/**
 * Body for the import routes, alongside the uploaded file.
 *
 * Multipart, so every field arrives as a string — hence no `@IsBoolean()`
 * anywhere here. The one real setting is the conflict policy.
 */
export class ImportRequestDto {
    @ApiPropertyOptional({
        enum: CONFLICT_POLICIES,
        default: CONFLICT_POLICY.Skip,
        description:
            'What to do when an incoming record matches one that already exists. `skip` (the default) cannot lose data; `update` overwrites; `duplicate` writes a second row; `fail` refuses the whole run on the first match.'
    })
    @IsOptional()
    @IsIn(CONFLICT_POLICIES)
    policy?: ConflictPolicy;
}
