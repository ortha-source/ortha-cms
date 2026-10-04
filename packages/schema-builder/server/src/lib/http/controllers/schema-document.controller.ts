import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
    PERMISSIONS,
    PermissionsGuard,
    RequirePermissions
} from '@orthacms/identity-server';
import type { SchemaDocumentEnvelope } from '@orthacms/schema-builder-domain';
import { LoadDocumentUseCase } from '../../application/load-document.use-case';

/**
 * The content model as a document. Global, like `GET /content-schema`: types
 * are declared in code and are the same in every workspace. Reading it needs
 * only `content:read` — editing is a separate permission on separate routes.
 */
@ApiTags('schema-builder')
@UseGuards(PermissionsGuard)
@Controller('schema-builder')
export class SchemaDocumentController {
    constructor(private readonly load: LoadDocumentUseCase) {}

    @ApiOperation({
        summary: 'The content model as an editable document',
        description:
            'Every registered content type with its fields and General-tab groups, who owns each ' +
            'type file (the schema builder or a person), whether this server may edit at all, a ' +
            'fingerprint to send back with a plan or an apply, and the process boot id.'
    })
    @ApiOkResponse({ description: 'The document envelope.' })
    @RequirePermissions(PERMISSIONS.CONTENT_READ)
    @Get('document')
    document(): Promise<SchemaDocumentEnvelope> {
        return this.load.execute();
    }
}
