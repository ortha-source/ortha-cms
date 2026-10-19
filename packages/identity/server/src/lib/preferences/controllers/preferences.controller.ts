import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Put,
    UseGuards
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { PublicUser } from '../../auth/services/auth.service';
import { OriginGuard } from '../../auth/guards/origin.guard';
import { UpdatePreferencesDto } from '../dto/update-preferences.dto';
import {
    PreferencesService,
    type UserPreferences
} from '../services/preferences.service';

/**
 * The current user's own appearance preferences, under `/api/preferences`:
 *
 * - `GET /api/preferences` — the caller's stored preferences (or defaults if
 *   they have never saved any).
 * - `PUT /api/preferences` — upsert a partial patch; `Origin`-guarded like the
 *   other state-changing routes and validated by the global `ValidationPipe`.
 *   Every field is optional — an absent one keeps its stored value, and
 *   `layout` merges per panel — but a patch naming nothing is a `400`: it can
 *   only be a client bug, and answering it `200` would hide one.
 *
 * These are **self-service** — a user always reads and writes *their own* row,
 * identified by `@CurrentUser()` (the app-wide `AuthGuard` guarantees a session),
 * so there is no RBAC permission to gate: everyone owns their preferences.
 */
@Controller('preferences')
export class PreferencesController {
    constructor(private readonly preferences: PreferencesService) {}

    @Get()
    async get(@CurrentUser() user: PublicUser): Promise<UserPreferences> {
        return this.preferences.get(user.id);
    }

    @Put()
    @UseGuards(OriginGuard)
    async update(
        @CurrentUser() user: PublicUser,
        @Body() body: UpdatePreferencesDto
    ): Promise<UserPreferences> {
        if (body.theme === undefined && body.layout === undefined) {
            throw new BadRequestException(
                'A preferences patch must name `theme` or `layout`.'
            );
        }
        return this.preferences.save(user.id, body);
    }
}
