import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsDefined,
    IsEmail,
    IsIn,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
    ValidateNested
} from 'class-validator';
import { WORKSPACE_COLORS } from '../../domain/value-objects/workspace-color';

/**
 * Upper bound on `members` in one create. Provisioning resolves each entry with
 * its own round-trips, serially, inside the create transaction — so this caps
 * how long a single request can hold that transaction open. Generous for real
 * use (a workspace is seeded with a team, not a mailing list) and far below the
 * point where the serial walk becomes a self-inflicted outage.
 */
export const MAX_MEMBERS_PER_CREATE = 200;

/** A member being granted access. The owner is derived from the session. */
export class CreateWorkspaceMemberDto {
    /** Directory user id, or the typed email for an invited member. */
    @ApiProperty({
        type: String,
        minLength: 1,
        description:
            'Directory user id (uuid) for an existing account, or the typed email when `invited` is true.'
    })
    @IsString()
    @IsNotEmpty()
    id!: string;

    /** Display name (the email for invited members). */
    @ApiProperty({
        type: String,
        description:
            'Display name. For an invited member this is typically the email itself.'
    })
    @IsString()
    name!: string;

    /**
     * Contact email. Validated as a real address, not merely non-empty: an
     * `invited` member is **provisioned as a user account** keyed on this
     * value, so anything that gets through here becomes a permanent directory
     * row. A whitespace-only value used to normalise to `''` and create a
     * single empty-email account that every later blank invite then reused,
     * silently cross-linking unrelated workspaces through one ghost user.
     */
    @ApiProperty({
        type: String,
        format: 'email',
        minLength: 1,
        example: 'grace@example.com',
        description:
            'Contact email. Must be a valid address — an invited member is provisioned as a user account keyed on it.'
    })
    @IsEmail()
    @IsNotEmpty()
    email!: string;

    /** Whether this is an invite-by-email rather than an existing account. */
    @ApiProperty({
        type: Boolean,
        description:
            'True when this is an invite-by-email: a pending user is provisioned for the address instead of linking an existing account.'
    })
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
    @ApiProperty({
        enum: ['specific', 'all'],
        description:
            'Selection strategy: `specific` grants the slugs in `ids`; `all` grants everything of that kind minus `excludedIds`.'
    })
    @IsIn(['specific', 'all'])
    mode!: 'specific' | 'all';

    /** Explicit slugs — `specific` mode. */
    @ApiPropertyOptional({
        type: [String],
        example: ['article', 'author'],
        description: 'Explicit content-type slugs — `specific` mode only.'
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    ids?: string[];

    /** Blacklisted slugs — `all` mode. */
    @ApiPropertyOptional({
        type: [String],
        description: 'Content-type slugs to exclude — `all` mode only.'
    })
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
    @ApiProperty({
        enum: ['all', 'specific'],
        description:
            'Top-level decision: `all` grants every content type; `specific` carries the per-kind selections below.'
    })
    @IsIn(['all', 'specific'])
    mode!: 'all' | 'specific';

    /** Collection selection — only meaningful when `mode === 'specific'`. */
    @ApiPropertyOptional({
        type: () => ResourceSelectionDto,
        description:
            'Collection selection. Only meaningful when `mode` is `specific`.'
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => ResourceSelectionDto)
    collections?: ResourceSelectionDto;

    /** Page selection — only meaningful when `mode === 'specific'`. */
    @ApiPropertyOptional({
        type: () => ResourceSelectionDto,
        description:
            'Page selection. Only meaningful when `mode` is `specific`.'
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => ResourceSelectionDto)
    pages?: ResourceSelectionDto;
}

/** Body of `POST /api/workspaces`. */
export class CreateWorkspaceDto {
    /** Workspace display name. */
    @ApiProperty({
        type: String,
        minLength: 1,
        maxLength: 120,
        example: 'Marketing site',
        description: 'Workspace display name.'
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    name!: string;

    /**
     * URL slug. Only length/type are checked here; the lowercase-letters/
     * digits/hyphens format rule lives on the {@link Slug} value object
     * (`Slug.create`), which the create use-case applies — an invalid slug is
     * still rejected with HTTP 400.
     */
    @ApiProperty({
        type: String,
        maxLength: 120,
        pattern: '^[a-z0-9-]+$',
        example: 'marketing-site',
        description:
            'URL slug. Length/type are checked here; the lowercase-letters/digits/hyphens format rule is enforced by the `Slug` value object — an invalid slug is still a 400. Must be unique.'
    })
    @IsString()
    @MaxLength(120)
    slug!: string;

    /** Optional long description. */
    @ApiProperty({
        type: String,
        maxLength: 2000,
        example: '',
        description:
            'Long description. Required as a field — send an empty string for none.'
    })
    @IsString()
    @MaxLength(2000)
    description!: string;

    /** Accent color key from the design-system palette. */
    @ApiProperty({
        enum: [...WORKSPACE_COLORS],
        example: 'slate',
        description: 'Accent color key from the design-system avatar palette.'
    })
    @IsIn(WORKSPACE_COLORS)
    color!: string;

    /**
     * Members to add. The owner (current user) is implied, not listed here.
     *
     * Bounded because provisioning walks the array **serially inside the create
     * transaction**, so its length directly sets how long that write
     * transaction is held open — an unbounded array lets any
     * `workspaces:create` holder pin a connection for as long as they like.
     */
    @ApiProperty({
        type: () => [CreateWorkspaceMemberDto],
        maxItems: MAX_MEMBERS_PER_CREATE,
        description:
            'Members to add. The creator is implied — do not list them here.'
    })
    @IsArray()
    @ArrayMaxSize(MAX_MEMBERS_PER_CREATE)
    @ValidateNested({ each: true })
    @Type(() => CreateWorkspaceMemberDto)
    members!: CreateWorkspaceMemberDto[];

    /** Content access grant. */
    @ApiProperty({
        type: () => ContentDto,
        description:
            'Content access grant, flattened server-side into explicit `workspace_content` rows.'
    })
    @IsDefined()
    @ValidateNested()
    @Type(() => ContentDto)
    content!: ContentDto;
}
