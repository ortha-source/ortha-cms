import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Body for `POST /api/workspaces/:id/content` — the content-type slug to grant
 * the workspace access to. The kind (`collection`/`single`) is resolved
 * server-side from the code-defined catalogue, so the client sends only the
 * slug; an unknown slug is rejected.
 */
export class AddWorkspaceContentDto {
    /** The code-defined content-type slug to grant. */
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    slug!: string;
}
