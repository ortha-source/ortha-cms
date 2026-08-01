import { ApiPropertyOptional } from '@nestjs/swagger';
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
    @IsOptional()
    @IsString()
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
