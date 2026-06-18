import { Controller, Get, Inject, Optional } from '@nestjs/common';
import {
    CONTENT_TYPES,
    type ContentTypeDescriptor
} from '../content.constants';
import { CONTENT_CATALOG, type ContentCatalog } from '../content-catalog';

/**
 * `GET /api/content-types` — lists every content type a workspace can be granted
 * access to. Authentication is enforced by the app-wide `AuthGuard`.
 *
 * Backed by the content plugin's code-defined registry via the
 * {@link CONTENT_CATALOG} port; falls back to the built-in mock catalogue when
 * no content plugin is registered, so the workspace flow still works standalone.
 */
@Controller('content-types')
export class ListContentTypesController {
    constructor(
        @Optional()
        @Inject(CONTENT_CATALOG)
        private readonly catalog?: ContentCatalog
    ) {}

    @Get()
    list(): readonly ContentTypeDescriptor[] {
        return this.catalog?.list() ?? CONTENT_TYPES;
    }
}
