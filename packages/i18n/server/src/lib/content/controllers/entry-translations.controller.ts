import {
    Body,
    Controller,
    HttpCode,
    Param,
    Post,
    UseGuards
} from '@nestjs/common';
import {
    OriginGuard,
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions
} from '@orthacms/identity-server';
import { CurrentWorkspace, WorkspaceGuard } from '@orthacms/workspaces-server';
import { InjectContentRegistry } from '@orthacms/content-server';
import type { ContentTypeRegistry } from '@orthacms/content-server';
import { EntryTranslationsDto } from '../dto/entry-translations.dto';
import {
    LocaleGroupService,
    type EntryTranslationsView
} from '../services/locale-group.service';
import { resolveI18nType } from './resolve-type';

/**
 * `POST /api/i18n/content/:typeName/translations` — per requested **entry id**,
 * its translation group: the entry's own locale and title, and every live
 * member of the group with its title and publish state. Gated on
 * `content:read`, workspace-scoped.
 *
 * It is what the records view's **Publish with translations** picker reads: a
 * selection is a set of ids spanning pages, so there is no row on screen to
 * read a group id off, and the locale-summary batch (keyed by group) cannot
 * answer it. The publish itself goes through content's own bulk publish —
 * translations are entries of the same type — so this route only reads.
 *
 * A POST that is a read, for the same reasons as `locale-summary`: a selection
 * of uuids outgrows a query string, so it answers `200`, and it carries
 * `OriginGuard` because the guard keys off the verb a browser sees.
 */
@UseGuards(OriginGuard, PermissionsGuard, WorkspaceGuard)
@RequirePermissions(PERMISSIONS.CONTENT_READ)
@Controller('i18n/content')
export class EntryTranslationsController {
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly groups: LocaleGroupService
    ) {}

    @Post(':typeName/translations')
    @HttpCode(200)
    translations(
        @Param('typeName') typeName: string,
        @Body() body: EntryTranslationsDto,
        @CurrentWorkspace() workspaceId: string
    ): Promise<EntryTranslationsView> {
        const type = resolveI18nType(this.registry, typeName);
        return this.groups.translationsOf(type, body.ids, workspaceId);
    }
}
