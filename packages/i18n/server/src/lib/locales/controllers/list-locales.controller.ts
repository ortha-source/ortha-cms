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
 *
 * Each item carries everything a consumer needs to render the language
 * *correctly*, not just to name it: `slug` doubles as the HTML `lang` value
 * (it is a BCP-47 tag by contract) and `dir` is the resolved text direction.
 * Together they are what lets the entry editor, the preview, and a published
 * page mark up a translation as the language it is — which is the whole of
 * WCAG 3.1.2 and, for an RTL locale, of 1.3.2.
 */
@Controller('i18n')
export class ListLocalesController {
    constructor(private readonly locales: LocaleRegistryService) {}

    @Get('locales')
    list(): LocalesView {
        return {
            items: this.locales.all().map(({ slug, name, isDefault, dir }) => ({
                slug,
                name,
                isDefault: isDefault ?? false,
                // The registry always resolves a direction; the fallback is
                // for type flow only.
                dir: dir ?? 'ltr'
            }))
        };
    }
}
