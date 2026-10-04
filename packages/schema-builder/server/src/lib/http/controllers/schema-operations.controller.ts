import {
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    UseGuards
} from '@nestjs/common';
import {
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiTags
} from '@nestjs/swagger';
import {
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions
} from '@orthacms/identity-server';
import type { ApplyOperation } from '@orthacms/schema-builder-domain';
import { ReadOperationUseCase } from '../../application/apply/read-operation.use-case';

/**
 * Where an apply stands. Not behind the editable guard: the process asked is
 * usually the one the apply restarted into, and reading a record changes
 * nothing.
 */
@ApiTags('schema-builder')
@UseGuards(PermissionsGuard)
@Controller('schema-builder/operations')
export class SchemaOperationsController {
    constructor(private readonly read: ReadOperationUseCase) {}

    @ApiOperation({
        summary: 'One apply: its step, status, migrations, files and any error'
    })
    @ApiOkResponse({
        description:
            'The operation. `interrupted` when the process that ran it is gone.'
    })
    @ApiNotFoundResponse({ description: 'No apply by that id.' })
    @RequirePermissions(PERMISSIONS.SCHEMA_MANAGE)
    @Get(':id')
    execute(
        @Param('id', new ParseUUIDPipe()) id: string
    ): Promise<ApplyOperation> {
        return this.read.execute(id);
    }
}
