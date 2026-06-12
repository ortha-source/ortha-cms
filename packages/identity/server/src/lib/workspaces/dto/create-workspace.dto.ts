import { Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsDefined,
    IsIn,
    IsNotEmpty,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    ValidateNested
} from 'class-validator';

/** A member being granted access. The owner is derived from the session. */
export class CreateWorkspaceMemberDto {
    /** Directory user id, or the typed email for an invited member. */
    @IsString()
    @IsNotEmpty()
    id!: string;

    /** Display name (the email for invited members). */
    @IsString()
    name!: string;

    /** Contact email. */
    @IsString()
    @IsNotEmpty()
    email!: string;

    /** Whether this is an invite-by-email rather than an existing account. */
    @IsBoolean()
    invited!: boolean;
}

/**
 * A collection/page selection. `specific` lists explicit slugs in `ids`; `all`
 * grants everything of that kind minus `excludedIds`. The server flattens both
 * into explicit `workspace_content` rows.
 */
export class ResourceSelectionDto {
    /** Selection strategy. */
    @IsIn(['specific', 'all'])
    mode!: 'specific' | 'all';

    /** Explicit slugs — `specific` mode. */
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    ids?: string[];

    /** Blacklisted slugs — `all` mode. */
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    excludedIds?: string[];
}

/**
 * Content access. `all` grants every content type; `specific` carries the
 * per-kind collection and page selections.
 */
export class ContentDto {
    /** Page-level decision. */
    @IsIn(['all', 'specific'])
    mode!: 'all' | 'specific';

    /** Collection selection — only meaningful when `mode === 'specific'`. */
    @IsOptional()
    @ValidateNested()
    @Type(() => ResourceSelectionDto)
    collections?: ResourceSelectionDto;

    /** Page selection — only meaningful when `mode === 'specific'`. */
    @IsOptional()
    @ValidateNested()
    @Type(() => ResourceSelectionDto)
    pages?: ResourceSelectionDto;
}

/** Body of `POST /api/workspaces`. */
export class CreateWorkspaceDto {
    /** Workspace display name. */
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    name!: string;

    /** URL slug; lowercase letters, digits, and hyphens. */
    @IsString()
    @Matches(/^[a-z0-9-]+$/, {
        message: 'slug must contain only lowercase letters, digits, and hyphens'
    })
    @MaxLength(120)
    slug!: string;

    /** Optional long description. */
    @IsString()
    @MaxLength(2000)
    description!: string;

    /** Accent color key from the design-system palette. */
    @IsString()
    @IsNotEmpty()
    color!: string;

    /** Members to add. The owner (current user) is implied, not listed here. */
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateWorkspaceMemberDto)
    members!: CreateWorkspaceMemberDto[];

    /** Content access grant. */
    @IsDefined()
    @ValidateNested()
    @Type(() => ContentDto)
    content!: ContentDto;
}
