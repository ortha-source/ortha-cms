import { Controller, Get } from '@nestjs/common';
import { ContentCatalogReader } from '../../application/content/content-catalog.reader';
import type { ContentTypeDescriptor } from '../../application/ports/content-type-descriptor';

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
    constructor(private readonly catalog: ContentCatalogReader) {}

    @Get()
    list(): readonly ContentTypeDescriptor[] {
        return this.catalog.list();
    }
}
