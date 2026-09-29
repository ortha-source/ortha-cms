import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength
} from 'class-validator';

/**
 * Body for `POST /api/workspaces/:id/content` — the content-type slug to grant
 * the workspace access to. The kind (`collection`/`single`) is resolved
 * server-side from the code-defined catalogue, so the client sends only the
 * slug; an unknown slug is rejected.
 *
 * With `sourceWorkspaceId` the grant is a **shared** one (ADR-0019, "Explicit
 * per-source grants"): read and link that shared workspace's `slug` records.
 */
export class AddWorkspaceContentDto {
    /** The code-defined content-type slug to grant. */
    @ApiProperty({
        type: String,
        minLength: 1,
        maxLength: 120,
        example: 'article',
        description:
            'The code-defined content-type slug to grant. Its kind (collection/single) is resolved from the catalogue server-side; an unknown slug is rejected.'
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    slug!: string;

    /** The shared workspace to read `slug` records from; omit for an own grant. */
    @ApiPropertyOptional({
        type: String,
        format: 'uuid',
        description:
            'Grant a shared workspace’s records of `slug` instead of this workspace’s own. Must be a shared, non-archived workspace other than this one that holds its own grant for `slug` — otherwise 422.'
    })
    @IsOptional()
    @IsUUID()
    sourceWorkspaceId?: string;
}
