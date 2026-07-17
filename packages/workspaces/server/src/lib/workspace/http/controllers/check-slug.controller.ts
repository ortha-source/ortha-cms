import { Controller, Get, Query } from '@nestjs/common';
import { SlugAvailabilityQuery } from '../../infrastructure/queries/slug-availability.query';
import { CheckSlugDto } from '../../application/dto/check-slug.dto';

/**
 * `GET /api/workspaces/slug-available?slug=` — reports whether a slug is free,
 * backing the create wizard's live availability check.
 */
@Controller('workspaces')
export class CheckSlugController {
    constructor(private readonly slugs: SlugAvailabilityQuery) {}

    @Get('slug-available')
    async check(
        @Query() query: CheckSlugDto
    ): Promise<{ available: boolean }> {
        return { available: await this.slugs.isAvailable(query.slug) };
    }
}
