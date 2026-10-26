import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    ArrayMaxSize,
    ArrayMinSize,
    ArrayUnique,
    IsArray,
    IsEmail,
    IsIn,
    IsOptional,
    IsUUID
} from 'class-validator';
import { INVITE_BATCH_MAX } from '../../member.constants';
import {
    ASSIGNABLE_ROLE_KEYS,
    type AssignableRoleKey
} from '../../domain/value-objects/role';

/**
 * Body for `POST /api/users/invites/batch` — invites several people at once,
 * all with the same role and the same workspaces (the admin's invite sheet).
 */
export class InviteMembersDto {
    /**
     * The addresses to invite. Trimmed and lower-cased **before** validation,
     * so `Ada@x.io` and `ada@x.io` are caught as the same address by
     * `@ArrayUnique` instead of reaching the database's case-insensitive unique
     * index as two inserts.
     */
    @ApiProperty({
        type: [String],
        format: 'email',
        minItems: 1,
        maxItems: INVITE_BATCH_MAX,
        uniqueItems: true,
        example: ['lena@growth.io', 'sam@growth.io'],
        description: `Invite recipients, 1–${INVITE_BATCH_MAX}, matched case-insensitively. If any already belongs to an account the whole batch is a 409 naming them, and nobody is invited.`
    })
    @Transform(({ value }) =>
        Array.isArray(value)
            ? value.map((item) =>
                  typeof item === 'string' ? item.trim().toLowerCase() : item
              )
            : value
    )
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(INVITE_BATCH_MAX)
    @ArrayUnique()
    @IsEmail({}, { each: true })
    emails!: string[];

    /** Role key every new member starts with. */
    @ApiProperty({
        enum: [...ASSIGNABLE_ROLE_KEYS],
        example: 'contributor',
        description:
            'Global role every new member starts with — one of the three seeded system roles.'
    })
    @IsIn(ASSIGNABLE_ROLE_KEYS)
    role!: AssignableRoleKey;

    /** Workspaces every new member joins. Unknown ids are ignored server-side. */
    @ApiPropertyOptional({
        type: [String],
        format: 'uuid',
        uniqueItems: true,
        description:
            'Workspaces every new member is granted access to. Optional; unknown ids are ignored server-side.'
    })
    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @IsUUID('4', { each: true })
    workspaceIds?: string[];
}
