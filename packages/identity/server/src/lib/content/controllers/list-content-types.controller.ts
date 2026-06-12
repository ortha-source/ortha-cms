import { Controller, Get } from '@nestjs/common';
import {
    CONTENT_TYPES,
    type ContentTypeDescriptor
} from '../content.constants';

/**
 * `GET /api/content-types` — lists every content type a workspace can be granted
 * access to. Authentication is enforced by the app-wide `AuthGuard`. Returns the
 * server-owned mock catalogue today; the contract is stable for when a real
 * content-modeling plugin replaces the source.
 */
@Controller('content-types')
export class ListContentTypesController {
    @Get()
    list(): readonly ContentTypeDescriptor[] {
        return CONTENT_TYPES;
    }
}
