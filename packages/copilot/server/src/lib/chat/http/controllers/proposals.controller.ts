import {
    BadRequestException,
    ConflictException,
    Controller,
    ForbiddenException,
    Get,
    HttpCode,
    NotFoundException,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
    UnprocessableEntityException,
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
    ProposalRepository,
    type ProposalView
} from '../../infrastructure/persistence/proposal.repository';
import {
    DecideProposalService,
    type DecisionOutcome
} from '../../application/decide-proposal.service';
import { ListProposalsQueryDto } from '../../application/dto/list-proposals-query.dto';

/**
 * `GET/POST /api/copilot/proposals…` — the review queue and the accept/reject
 * boundary ([ADR-0005](../../../../../../docs/adr/0005-copilot-authority-model.md) §5).
 *
 * **`copilot:use` is the route's requirement, not the change's.** Whether this
 * caller may apply *this* proposal is decided by `DecideProposalService`, which
 * re-resolves the capability profile and requires the proposing tool to still be
 * offered to them — so a viewer with `copilot:use` can see the queue and cannot
 * approve a content edit in it. Putting `content:update` on the route instead
 * would be both too strict (it would hide media proposals from a content
 * editor) and too loose (it would let one content permission approve every kind
 * of change).
 *
 * The writes carry `OriginGuard`; the reads do not, matching every other
 * cookie-authenticated surface here.
 */
@UseGuards(PermissionsGuard, WorkspaceGuard)
@RequirePermissions(PERMISSIONS.COPILOT_USE)
@Controller('copilot')
export class ProposalsController {
    constructor(
        private readonly proposals: ProposalRepository,
        private readonly decisions: DecideProposalService
    ) {}

    @Get('proposals')
    @ApiOperation({ summary: 'List the workspace’s copilot proposals' })
    async list(
        @Query() query: ListProposalsQueryDto,
        @CurrentWorkspace() workspaceId: string
    ): Promise<{ items: ProposalView[] }> {
        return {
            items: await this.proposals.list(workspaceId, {
                ...(query.status ? { status: query.status } : {}),
                ...(query.conversationId
                    ? { conversationId: query.conversationId }
                    : {})
            })
        };
    }

    @Get('proposals/:id')
    @ApiOperation({ summary: 'Read one copilot proposal' })
    async get(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentWorkspace() workspaceId: string
    ): Promise<ProposalView> {
        const proposal = await this.proposals.find(id, workspaceId);
        if (!proposal) {
            throw new NotFoundException(`No proposal "${id}".`);
        }
        return proposal;
    }

    @Post('proposals/:id/accept')
    @HttpCode(200)
    @UseGuards(OriginGuard)
    @ApiOperation({ summary: 'Accept a proposal, applying the change' })
    async accept(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: PublicUser,
        @CurrentWorkspace() workspaceId: string
    ): Promise<ProposalView> {
        return unwrap(
            await this.decisions.accept(id, {
                userId: user.id,
                email: user.email,
                roleId: user.roleId,
                workspaceId
            })
        );
    }

    @Post('proposals/:id/reject')
    @HttpCode(200)
    @UseGuards(OriginGuard)
    @ApiOperation({ summary: 'Reject a proposal, writing nothing' })
    async reject(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: PublicUser,
        @CurrentWorkspace() workspaceId: string
    ): Promise<ProposalView> {
        return unwrap(
            await this.decisions.reject(id, {
                userId: user.id,
                email: user.email,
                roleId: user.roleId,
                workspaceId
            })
        );
    }
}

/**
 * Turns a decision outcome into a response or the matching HTTP error.
 *
 * The mapping is deliberate rather than uniform: `409` says "someone got there
 * first" and the client should refresh rather than retry, while `422` says the
 * apply failed and the proposal is still pending — the one case where retrying
 * the same request is the right move. Collapsing them into one status would
 * make those two indistinguishable to the UI.
 */
function unwrap(outcome: DecisionOutcome): ProposalView {
    if (outcome.ok) {
        return outcome.proposal;
    }
    switch (outcome.reason) {
        case 'not-found':
            throw new NotFoundException(outcome.message);
        case 'already-decided':
            throw new ConflictException(outcome.message);
        case 'not-permitted':
            throw new ForbiddenException(outcome.message);
        case 'apply-failed':
            throw new UnprocessableEntityException(outcome.message);
        case 'no-applier':
            // A deployment wiring bug, surfaced as a bad request rather than a
            // 500: nothing is broken at runtime, this change simply cannot be
            // carried out here, and the message says so.
            throw new BadRequestException(outcome.message);
    }
}
