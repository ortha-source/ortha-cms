import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body of `PATCH /api/workspaces/:id` — a partial edit of a workspace's
 * profile. Every field is optional; only the ones present are written. The slug
 * is intentionally **not** editable here (it's the workspace's stable URL
 * identifier), and status changes go through the dedicated archive routes.
 */
export class UpdateWorkspaceDto {
    /** New display name. */
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    name?: string;

    /** New long description; an empty string clears it. */
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;

    /** New accent color key from the design-system palette. */
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    color?: string;
}
