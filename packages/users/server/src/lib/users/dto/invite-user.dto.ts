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
} from '../users.constants';

/** Body for `POST /api/users/invites` — invites a person by email. */
export class InviteUserDto {
    /** Invite recipient. Must not collide with an existing account. */
    @IsEmail()
    email!: string;

    /** Role key the new member starts with. */
    @IsIn(ASSIGNABLE_ROLE_KEYS)
    role!: AssignableRoleKey;

    /** Optional display name to pre-fill; the invitee can change it. */
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    name?: string;

    /**
     * Workspaces to grant the new member access to (memberships). Optional —
     * access can be granted later. Unknown ids are ignored server-side.
     */
    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @IsUUID('4', { each: true })
    workspaceIds?: string[];
}
