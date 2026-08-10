import {
    BadRequestException,
    Body,
    Controller,
    NotFoundException,
    Param,
    ParseUUIDPipe,
    Patch,
    UseGuards
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import {
    CurrentUser,
    OriginGuard,
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions,
    type PublicUser
} from '@ortha-cms/identity-server';
import { CurrentWorkspace, WorkspaceGuard } from '@ortha-cms/workspaces-server';
import {
    ConversationRepository,
    type ConversationView
} from '../../infrastructure/persistence/conversation.repository';
import { UpdateConversationDto } from '../../application/dto/update-conversation.dto';

/**
 * `PATCH /api/copilot/conversations/:id` — rename a thread, file it away, or
 * bring it back.
 *
 * **Archiving is the only removal this API offers, and it is reversible.** A
 * thread's proposals are the receipts for changes that were actually made to
 * the caller's content (ADR-0009), so deleting a conversation would take the
 * only record of those edits with it. Hiding it from the list is the part
 * people want; destroying the audit trail is not, and if a hard delete is ever
 * added it needs to answer for the proposals first.
 *
 * A thread the caller doesn't own is a **404, not a 403** — the repository
 * filters on user and workspace and reports "not found" either way, so an id
 * cannot be probed for existence. `OriginGuard` because this changes state.
 */
@UseGuards(PermissionsGuard, WorkspaceGuard)
@RequirePermissions(PERMISSIONS.COPILOT_USE)
@Controller('copilot')
export class UpdateConversationController {
    constructor(private readonly conversations: ConversationRepository) {}

    @Patch('conversations/:id')
    @UseGuards(OriginGuard)
    @ApiOperation({ summary: 'Rename or archive a copilot conversation' })
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: UpdateConversationDto,
        @CurrentUser() user: PublicUser,
        @CurrentWorkspace() workspaceId: string
    ): Promise<ConversationView> {
        // An empty patch cannot mean anything, and answering 200 to it would
        // report success for a write that never happened. The pipe cannot catch
        // this: every property is legitimately optional on its own.
        if (body.title === undefined && body.archived === undefined) {
            throw new BadRequestException(
                'Provide a title, an archived flag, or both.'
            );
        }

        const updated = await this.conversations.update(
            id,
            user.id,
            workspaceId,
            {
                ...(body.title !== undefined ? { title: body.title } : {}),
                ...(body.archived !== undefined
                    ? { archived: body.archived }
                    : {})
            }
        );

        if (!updated) {
            throw new NotFoundException('Conversation not found.');
        }
        return updated;
    }
}
