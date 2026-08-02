import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/** Body for `POST /api/workspaces/:id/members` — the user to add. */
export class AddWorkspaceMemberDto {
    /** The directory user id to link to the workspace. */
    @ApiProperty({
        type: String,
        format: 'uuid',
        description:
            'The directory user id to link to the workspace. Membership is a pure link — it carries no per-workspace role.'
    })
    @IsUUID()
    userId!: string;
}
