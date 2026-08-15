import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import {
    ASSIGNABLE_ROLE_KEYS,
    type AssignableRoleKey
} from '../../domain/value-objects/role';

/**
 * Body for `PATCH /api/users/:id` — partial update of a member's editable
 * fields. Both fields are optional; an empty body is a no-op that still
 * returns the fresh view.
 */
export class UpdateMemberDto {
    /** New display name. */
    @ApiPropertyOptional({
        type: String,
        minLength: 1,
        example: 'Grace Hopper',
        description: 'New display name. Omit to leave it unchanged.'
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

    /** New role key. Demoting the last active admin is rejected. */
    @ApiPropertyOptional({
        enum: [...ASSIGNABLE_ROLE_KEYS],
        description:
            'New global role. Demoting the last active admin, or re-roling your own account, is rejected.'
    })
    @IsOptional()
    @IsIn(ASSIGNABLE_ROLE_KEYS)
    role?: AssignableRoleKey;
}
