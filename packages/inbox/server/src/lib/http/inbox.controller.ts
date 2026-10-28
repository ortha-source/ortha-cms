import {
    Body,
    Controller,
    Get,
    HttpCode,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
    UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
    CurrentUser,
    OriginGuard,
    type PublicUser
} from '@orthacms/identity-server';
import { InboxService } from '../application/inbox.service';
import {
    InboxQueryDto,
    MarkAllReadDto
} from '../application/dto/inbox-query.dto';
import type { InboxPageView, InboxSummaryView } from '../types/inbox-views';

/**
 * The signed-in person's inbox, under `/api/inbox`, across every workspace
 * they belong to — so no `X-Workspace-Id`, and no permission: every route
 * reads or writes the caller's own rows, identified by the session, like
 * `/api/preferences`. API tokens never reach it — the app-wide guard is a
 * session guard, and a token names no person to have an inbox.
 */
@ApiTags('inbox')
@Controller('inbox')
export class InboxController {
    constructor(private readonly inbox: InboxService) {}

    @ApiOperation({
        summary: 'Count unread inbox items',
        description:
            'The caller’s unread items, in total and per tab — what the Inbox navigation badge shows.'
    })
    @Get('summary')
    summary(@CurrentUser() user: PublicUser): Promise<InboxSummaryView> {
        return this.inbox.summary(user.id);
    }

    @ApiOperation({
        summary: 'List inbox items',
        description:
            'The caller’s items, newest first, across every workspace they still belong to. `category` narrows to one tab, `unread=1` to what is unread; pass `nextCursor` as `before` for the next page.'
    })
    @Get()
    list(
        @CurrentUser() user: PublicUser,
        @Query() query: InboxQueryDto
    ): Promise<InboxPageView> {
        return this.inbox.page(user.id, query);
    }

    @ApiOperation({
        summary: 'Mark every inbox item read',
        description: 'Everything unread, or one tab’s with `category`.'
    })
    @Post('read')
    @HttpCode(200)
    @UseGuards(OriginGuard)
    markAllRead(
        @CurrentUser() user: PublicUser,
        @Body() body: MarkAllReadDto
    ): Promise<{ marked: number }> {
        return this.inbox.markAllRead(user.id, body.category);
    }

    @ApiOperation({
        summary: 'Mark one inbox item read',
        description: 'Idempotent. 404 for an id that is not the caller’s.'
    })
    @Post(':id/read')
    @HttpCode(204)
    @UseGuards(OriginGuard)
    async markRead(
        @CurrentUser() user: PublicUser,
        @Param('id', new ParseUUIDPipe()) id: string
    ): Promise<void> {
        await this.inbox.markRead(user.id, id);
    }
}
