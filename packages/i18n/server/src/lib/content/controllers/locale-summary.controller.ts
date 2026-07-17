import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import {
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions
} from '@ortha-cms/identity-server';
import {
    CurrentWorkspace,
    WorkspaceGuard
} from '@ortha-cms/workspaces-server';
import { InjectContentRegistry } from '@ortha-cms/content-server';
import type { ContentTypeRegistry } from '@ortha-cms/content-server';
import { LocaleSummaryDto } from '../dto/locale-summary.dto';
import {
    LocaleGroupService,
    type LocaleSummaryView
} from '../services/locale-group.service';
import { resolveI18nType } from './resolve-type';

/**
 * `POST /api/i18n/content/:typeName/locale-summary` — the records table's
 * batched read: per requested translation-group id, the group's live members
 * with per-row status. A POST because a page of group uuids outgrows a query
 * string; it reads, mutates nothing, so no `OriginGuard`. Gated on
 * `content:read`, workspace-scoped.
 */
@UseGuards(PermissionsGuard, WorkspaceGuard)
@RequirePermissions(PERMISSIONS.CONTENT_READ)
@Controller('i18n/content')
export class LocaleSummaryController {
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly groups: LocaleGroupService
    ) {}

    @Post(':typeName/locale-summary')
    summarize(
        @Param('typeName') typeName: string,
        @Body() body: LocaleSummaryDto,
        @CurrentWorkspace() workspaceId: string
    ): Promise<LocaleSummaryView> {
        const type = resolveI18nType(this.registry, typeName);
        return this.groups.summaries(type, body.groupIds, workspaceId);
    }
}
