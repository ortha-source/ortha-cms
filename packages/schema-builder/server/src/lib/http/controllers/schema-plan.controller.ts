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
    ApiBadRequestResponse,
    ApiConflictResponse,
    ApiForbiddenResponse,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
    ApiUnprocessableEntityResponse
} from '@nestjs/swagger';
import {
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions
} from '@orthacms/identity-server';
import type { SchemaPlan } from '@orthacms/schema-builder-domain';
import { PlanSchemaUseCase } from '../../application/plan/plan-schema.use-case';
import { PlanSchemaDto } from '../dto/plan-schema.dto';
import { SchemaBuilderErrorFilter } from '../filters/schema-builder-error.filter';
import { EditableGuard } from '../guards/editable.guard';

/**
 * What applying a draft would do, without doing it: the classified changes,
 * the files under `src/content/`, and drizzle-kit's SQL. Writes nothing the
 * app reads — only a scratch folder under `.orthacms/`, removed before it
 * answers.
 */
@ApiTags('schema-builder')
@UseFilters(SchemaBuilderErrorFilter)
@UseGuards(PermissionsGuard, EditableGuard)
@Controller('schema-builder')
export class SchemaPlanController {
    constructor(private readonly plan: PlanSchemaUseCase) {}

    @ApiOperation({
        summary:
            'Preview the changes, files and SQL an apply of a draft would make'
    })
    @ApiOkResponse({
        description:
            'The plan. A blocked draft is answered too, with blocked: true and no files or SQL.'
    })
    @ApiBadRequestResponse({
        description: 'The body is not a schema document.'
    })
    @ApiForbiddenResponse({
        description:
            'No schema:manage, or this server may not edit (production, flag off).'
    })
    @ApiConflictResponse({
        description:
            'The content model changed since the draft was made (stale fingerprint).'
    })
    @ApiUnprocessableEntityResponse({
        description:
            'The draft breaks a schema rule, or changes a hand-written type.'
    })
    @RequirePermissions(PERMISSIONS.SCHEMA_MANAGE)
    @HttpCode(HttpStatus.OK)
    @Post('plan')
    execute(@Body() body: PlanSchemaDto): Promise<SchemaPlan> {
        return this.plan.execute(body.document, body.baseFingerprint);
    }
}
