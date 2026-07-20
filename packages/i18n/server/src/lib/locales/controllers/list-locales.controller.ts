import { Controller, Get } from '@nestjs/common';
import type { LocaleDef } from '../../types/locale';
import { LocaleRegistryService } from '../services/locale-registry.service';

/** The `GET /api/i18n/locales` response envelope. */
export interface LocalesView {
    /** Configured locales in display order; exactly one `isDefault`. */
    items: LocaleDef[];
}

/**
 * `GET /api/i18n/locales` — the configured locales, in display order. The
 * admin's single source for the locale switcher / widget; any authenticated
 * session may read it (the global `AuthGuard` applies; locales carry no
 * per-workspace data).
 */
@Controller('i18n')
export class ListLocalesController {
    constructor(private readonly locales: LocaleRegistryService) {}

    @Get('locales')
    list(): LocalesView {
        return {
            items: this.locales
                .all()
                .map(({ slug, name, isDefault }) => ({
                    slug,
                    name,
                    isDefault: isDefault ?? false
                }))
        };
    }
}
