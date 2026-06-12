import {
    Body,
    ConflictException,
    Controller,
    Post
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { PublicUser } from '../../auth/services/auth.service';
import {
    WorkspaceService,
    type WorkspaceView
} from '../services/workspace.service';
import { CreateWorkspaceDto } from '../dto/create-workspace.dto';
import { SlugTakenError } from '../errors';

/**
 * `POST /api/workspaces` — creates a workspace owned by the current user. The
 * owner is derived from the session (`@CurrentUser()`), never the body; the
 * wizard's per-member role is ignored. A duplicate slug maps to 409.
 */
@Controller('workspaces')
export class CreateWorkspaceController {
    constructor(private readonly workspaces: WorkspaceService) {}

    @Post()
    async create(
        @Body() body: CreateWorkspaceDto,
        @CurrentUser() user: PublicUser
    ): Promise<WorkspaceView> {
        try {
            return await this.workspaces.create(body, user.id);
        } catch (error) {
            if (error instanceof SlugTakenError) {
                throw new ConflictException('Workspace slug already taken');
            }
            throw error;
        }
    }
}
