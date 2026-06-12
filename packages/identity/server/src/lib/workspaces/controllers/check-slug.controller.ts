import { Controller, Get, Query } from '@nestjs/common';
import { SlugService } from '../services/slug.service';
import { CheckSlugDto } from '../dto/check-slug.dto';

/**
 * `GET /api/workspaces/slug-available?slug=` — reports whether a slug is free,
 * backing the create wizard's live availability check.
 */
@Controller('workspaces')
export class CheckSlugController {
    constructor(private readonly slugs: SlugService) {}

    @Get('slug-available')
    async check(
        @Query() query: CheckSlugDto
    ): Promise<{ available: boolean }> {
        return { available: await this.slugs.available(query.slug) };
    }
}
