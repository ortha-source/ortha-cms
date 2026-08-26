import {
    Body,
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Put,
    UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
    OriginGuard,
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions
} from '@orthacms/identity-server';
import { CurrentWorkspace, WorkspaceGuard } from '@orthacms/workspaces-server';
import {
    EntryAccessService,
    type EntryAccessView
} from '../application/entry-access.service';
import { SetEntryAccessDto } from './segments.dto';

/**
 * One entry's access — read it, replace it.
 *
 * A `PUT`, not a `PATCH`, and that is the API telling the truth about what
 * happens: the editor submits the whole state of both lists and it becomes the
 * whole state. There is nothing to merge into, because there is nothing else
 * governing the entry — no rule to inherit from, no level above. What is sent
 * is what a reader is matched against on the next request.
 *
 * Workspace-scoped, so an entry id from another workspace cannot be written
 * through a session that holds this one.
 */
@ApiTags('Segments')
@Controller('segments/entries')
@UseGuards(PermissionsGuard, WorkspaceGuard)
export class EntryAccessController {
    constructor(private readonly access: EntryAccessService) {}

    /** One entry's lists. An entry nobody restricted reads as two empty ones. */
    @Get(':entryId')
    @RequirePermissions(PERMISSIONS.SEGMENTS_READ)
    @ApiOperation({
        summary: 'Read an entry’s access',
        description:
            'Two empty lists mean the entry is readable by everyone — the state every entry is in until somebody decides otherwise.'
    })
    get(
        @CurrentWorkspace() workspaceId: string,
        @Param('entryId', ParseUUIDPipe) entryId: string
    ): Promise<EntryAccessView> {
        return this.access.get(workspaceId, entryId);
    }

    /** Replace one entry's lists. */
    @Put(':entryId')
    @UseGuards(OriginGuard)
    @RequirePermissions(PERMISSIONS.SEGMENTS_MANAGE)
    @ApiOperation({
        summary: 'Set an entry’s access',
        description:
            'Replaces both lists. Sending two empty ones opens the entry to everyone and removes its row. The change is live when this answers — there is nothing to re-derive.'
    })
    set(
        @CurrentWorkspace() workspaceId: string,
        @Param('entryId', ParseUUIDPipe) entryId: string,
        @Body() body: SetEntryAccessDto
    ): Promise<EntryAccessView> {
        return this.access.set({
            workspaceId,
            entryId,
            typeSlug: body.typeSlug,
            allow: body.allow,
            deny: body.deny
        });
    }
}
