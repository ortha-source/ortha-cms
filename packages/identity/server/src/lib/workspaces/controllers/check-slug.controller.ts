import { Controller, Get, Query } from '@nestjs/common';
import { WorkspaceService } from '../services/workspace.service';
import { CheckSlugDto } from '../dto/check-slug.dto';

/**
 * `GET /api/workspaces/slug-available?slug=` — reports whether a slug is free,
 * backing the create wizard's live availability check.
 */
@Controller('workspaces')
export class CheckSlugController {
    constructor(private readonly workspaces: WorkspaceService) {}

    @Get('slug-available')
    async check(
        @Query() query: CheckSlugDto
    ): Promise<{ available: boolean }> {
        return { available: await this.workspaces.slugAvailable(query.slug) };
    }
}
