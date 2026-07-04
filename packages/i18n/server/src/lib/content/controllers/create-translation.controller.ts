import {
    Body,
    Controller,
    Param,
    ParseUUIDPipe,
    Post,
    UseGuards
} from '@nestjs/common';
import {
    CurrentWorkspace,
    OriginGuard,
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions,
    WorkspaceGuard
} from '@ortha-cms/identity-server';
import { InjectContentRegistry } from '@ortha-cms/content-server';
import type {
    ContentTypeRegistry,
    EntryRecord
} from '@ortha-cms/content-server';
import { CreateTranslationDto } from '../dto/create-translation.dto';
import { TranslationService } from '../services/translation.service';
import { resolveI18nType } from './resolve-type';

/**
 * `POST /api/i18n/content/:typeName/:id/translations` — create the target
 * locale's sibling of entry `:id` (all values copied as a starting point,
 * same translation group, draft). 409 when the group already holds that
 * locale. State-changing, so `OriginGuard` (CSRF) leads; creating a
 * translation is creating content — `content:create`.
 */
@UseGuards(OriginGuard, PermissionsGuard, WorkspaceGuard)
@RequirePermissions(PERMISSIONS.CONTENT_CREATE)
@Controller('i18n/content')
export class CreateTranslationController {
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly translations: TranslationService
    ) {}

    @Post(':typeName/:id/translations')
    create(
        @Param('typeName') typeName: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: CreateTranslationDto,
        @CurrentWorkspace() workspaceId: string
    ): Promise<EntryRecord> {
        const type = resolveI18nType(this.registry, typeName);
        return this.translations.create(type, id, body.locale, workspaceId);
    }
}
