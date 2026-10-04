import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Post,
    UseFilters,
    UseGuards
} from '@nestjs/common';
import {
    ApiAcceptedResponse,
    ApiConflictResponse,
    ApiForbiddenResponse,
    ApiOperation,
    ApiTags,
    ApiUnprocessableEntityResponse
} from '@nestjs/swagger';
import {
    CurrentUser,
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions,
    type PublicUser
} from '@orthacms/identity-server';
import type { ApplyAccepted } from '@orthacms/schema-builder-domain';
import { ApplySchemaUseCase } from '../../application/apply/apply-schema.use-case';
import { ApplySchemaDto } from '../dto/apply-schema.dto';
import { SchemaBuilderErrorFilter } from '../filters/schema-builder-error.filter';
import { EditableGuard } from '../guards/editable.guard';

/**
 * Applies a draft: generates the migration, runs it, writes `src/content/` —
 * and the dev watcher restarts the server. Answers `202` once the draft is
 * accepted; the work is followed through `GET /schema-builder/operations/:id`,
 * and the restart through the document's `bootId`.
 */
@ApiTags('schema-builder')
@UseFilters(SchemaBuilderErrorFilter)
@UseGuards(PermissionsGuard, EditableGuard)
@Controller('schema-builder')
export class SchemaApplyController {
    constructor(private readonly apply: ApplySchemaUseCase) {}

    @ApiOperation({ summary: 'Apply a planned change to the content model' })
    @ApiAcceptedResponse({
        description:
            'Accepted: the operation to follow and the boot id to wait past.'
    })
    @ApiForbiddenResponse({
        description: 'No schema:manage, or this server may not edit.'
    })
    @ApiConflictResponse({
        description:
            'Another apply is running, or the content model changed since the plan.'
    })
    @ApiUnprocessableEntityResponse({
        description:
            'A blocked change, an unconfirmed destructive change, a broken rule, or a hand-written type.'
    })
    @RequirePermissions(PERMISSIONS.SCHEMA_MANAGE)
    @HttpCode(HttpStatus.ACCEPTED)
    @Post('apply')
    execute(
        @Body() body: ApplySchemaDto,
        @CurrentUser() user?: PublicUser
    ): Promise<ApplyAccepted> {
        return this.apply.execute(body, user?.id ?? null);
    }
}
