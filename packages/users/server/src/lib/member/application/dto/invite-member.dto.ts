import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    ArrayUnique,
    IsArray,
    IsEmail,
    IsIn,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID
} from 'class-validator';
import {
    ASSIGNABLE_ROLE_KEYS,
    type AssignableRoleKey
} from '../../domain/value-objects/role';

/** Body for `POST /api/users/invites` — invites a person by email. */
export class InviteMemberDto {
    /** Invite recipient. Must not collide with an existing account. */
    @ApiProperty({
        type: String,
        format: 'email',
        example: 'grace@example.com',
        description:
            'Invite recipient. Matched case-insensitively — an address already on an account is a 409.'
    })
    @IsEmail()
    email!: string;

    /** Role key the new member starts with. */
    @ApiProperty({
        enum: [...ASSIGNABLE_ROLE_KEYS],
        example: 'contributor',
        description:
            'Global role the new member starts with — one of the three seeded system roles.'
    })
    @IsIn(ASSIGNABLE_ROLE_KEYS)
    role!: AssignableRoleKey;

    /** Optional display name to pre-fill; the invitee can change it. */
    @ApiPropertyOptional({
        type: String,
        minLength: 1,
        example: 'Grace Hopper',
        description:
            'Display name to pre-fill on the pending account; the invitee can change it.'
    })
    /**
     * Trimmed before validation, so a whitespace-only name is a `400` rather
     * than a stored blank. `@IsNotEmpty` alone rejects `''` but accepts
     * `'   '` — and this row is the only source of that person's human
     * identifier, so a blank one leaves every downstream surface (table row
     * header, avatar initials, an action's accessible name, the audit log's
     * actor column) with nothing to render.
     */
    @IsOptional()
    @IsString()
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim() : value
    )
    @IsNotEmpty()
    name?: string;

    /**
     * Workspaces to grant the new member access to (memberships). Optional —
     * access can be granted later. Unknown ids are ignored server-side.
     */
    @ApiPropertyOptional({
        type: [String],
        format: 'uuid',
        uniqueItems: true,
        description:
            'Workspaces to grant the new member access to (memberships). Optional — access can be granted later; unknown ids are ignored server-side.'
    })
    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @IsUUID('4', { each: true })
    workspaceIds?: string[];
}
