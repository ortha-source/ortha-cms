import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Body for `POST /api/workspaces/:id/content` — the content-type slug to grant
 * the workspace access to. The kind (`collection`/`single`) is resolved
 * server-side from the code-defined catalogue, so the client sends only the
 * slug; an unknown slug is rejected.
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
}
