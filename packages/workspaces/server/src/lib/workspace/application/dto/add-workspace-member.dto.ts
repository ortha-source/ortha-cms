import { IsUUID } from 'class-validator';

/** Body for `POST /api/workspaces/:id/members` — the user to add. */
export class AddWorkspaceMemberDto {
    /** The directory user id to link to the workspace. */
    @IsUUID()
    userId!: string;
}
