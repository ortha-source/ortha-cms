import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    IsIn,
    IsNotEmpty,
    IsOptional,
    IsString,
    ValidateIf
} from 'class-validator';
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
     *
     * Gated on `!== undefined` rather than `@IsOptional()`, which skips the
     * rest of the chain for `null` as well. On a *patch* the two are not the
     * same thing: the use case tests presence with `!== undefined`, so a
     * `null` that slipped past validation reached the aggregate as a real
     * value and cleared the stored name — the exact blank this field rejects
     * when it is spelled `''` or `'   '`. Letting `@IsString` see `null`
     * turns that into the 400 it always should have been.
     */
    @ValidateIf((dto: UpdateMemberDto) => dto.name !== undefined)
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
