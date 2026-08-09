import {
    Body,
    Controller,
    HttpCode,
    NotFoundException,
    Param,
    ParseUUIDPipe,
    Post,
    UseGuards
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import {
    OriginGuard,
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions
} from '@ortha-cms/identity-server';
import { WorkspaceGuard } from '@ortha-cms/workspaces-server';
import { ToolPermissionBroker } from '../../application/tool-permission.broker';
import { DecideToolPermissionDto } from '../../application/dto/decide-tool-permission.dto';

/**
 * `POST /api/copilot/runs/:runId/permission` — the answer to a parked run.
 *
 * **A second request against a run that is still streaming**, which is the only
 * shape available: the run is an SSE response, and a response cannot be asked
 * questions. The run yields a `tool-permission-request` carrying its `runId`
 * and the call id, and this route resolves the promise it is awaiting.
 *
 * It intentionally does **not** re-check whether the caller may use the tool.
 * That is not a gap: the offer filtered it, and `executeTool` re-authorizes
 * against freshly resolved grants immediately after this returns. What this
 * route decides is whether the user *wants* the call to happen, which is a
 * different question from whether they are allowed to make it — and answering
 * "yes" to a tool their role has since lost still ends in a refusal downstream.
 *
 * The 404 is load-bearing rather than cosmetic. Nothing waiting means the
 * decision arrived after the five-minute timeout, or the run is parked on
 * another instance (the broker is in-memory — see its notes). Both are worth
 * telling the client about, because in both cases the answer it just gave had
 * no effect.
 */
@UseGuards(PermissionsGuard, WorkspaceGuard)
@RequirePermissions(PERMISSIONS.COPILOT_USE)
@Controller('copilot')
export class ToolPermissionController {
    constructor(private readonly broker: ToolPermissionBroker) {}

    @Post('runs/:runId/permission')
    @HttpCode(204)
    @UseGuards(OriginGuard)
    @ApiOperation({
        summary: 'Allow or refuse one tool call in a running turn'
    })
    decide(
        @Param('runId', ParseUUIDPipe) runId: string,
        @Body() body: DecideToolPermissionDto
    ): void {
        const delivered = this.broker.decide(runId, body.callId, body.decision);
        if (!delivered) {
            throw new NotFoundException(
                'That request is no longer waiting for an answer.'
            );
        }
    }
}
