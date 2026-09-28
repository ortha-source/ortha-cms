import { ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsBoolean,
    IsIn,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength
} from 'class-validator';
import { WORKSPACE_COLORS } from '../../domain/value-objects/workspace-color';

/**
 * Body of `PATCH /api/workspaces/:id` — a partial edit of a workspace's
 * profile and its shared flag. Every field is optional; only the ones present are written. The slug
 * is intentionally **not** editable here (it's the workspace's stable URL
 * identifier), and status changes go through the dedicated archive routes.
 */
export class UpdateWorkspaceDto {
    /** New display name. */
    @ApiPropertyOptional({
        type: String,
        minLength: 1,
        maxLength: 120,
        description: 'New display name.'
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    name?: string;

    /** New long description; an empty string clears it. */
    @ApiPropertyOptional({
        type: String,
        maxLength: 2000,
        description: 'New long description; an empty string clears it.'
    })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;

    /** New accent color key from the design-system palette. */
    @ApiPropertyOptional({
        enum: [...WORKSPACE_COLORS],
        description: 'New accent color key from the design-system palette.'
    })
    @IsOptional()
    @IsIn(WORKSPACE_COLORS)
    color?: string;

    /**
     * Whether the workspace is **shared** (ADR-0019): its published entries
     * become readable and linkable — read-only — from every other workspace
     * granted the same content type.
     */
    @ApiPropertyOptional({
        type: Boolean,
        description:
            'Share this workspace: its published entries become readable and linkable (read-only) from every other workspace granted the same content type.'
    })
    @IsOptional()
    @IsBoolean()
    isShared?: boolean;
}
