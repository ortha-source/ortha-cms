import {
    IsEmail,
    IsIn,
    IsNotEmpty,
    IsOptional,
    IsString
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
}
