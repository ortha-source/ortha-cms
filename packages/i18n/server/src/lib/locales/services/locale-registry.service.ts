import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { I18N_CONFIG } from '../../i18n.constants';
import type { I18nPluginConfig, LocaleDef } from '../../types/locale';

/**
 * Read access to the validated locale configuration — the runtime authority
 * every other i18n service consults. The config is validated eagerly by the
 * plugin factory (unique slugs, exactly one default), so lookups here can
 * assume a well-formed set.
 */
@Injectable()
export class LocaleRegistryService {
    private readonly bySlug: Map<string, LocaleDef>;
    private readonly defaultLocale: LocaleDef;

    constructor(@Inject(I18N_CONFIG) config: I18nPluginConfig) {
        this.bySlug = new Map(
            config.locales.map((locale) => [locale.slug, locale])
        );
        // The factory guarantees exactly one — the assertion is for type flow.
        const fallback = config.locales.find((locale) => locale.isDefault);
        if (!fallback) throw new Error('I18n config has no default locale.');
        this.defaultLocale = fallback;
    }

    /** All configured locales, in config (display) order. */
    all(): LocaleDef[] {
        return [...this.bySlug.values()];
    }

    /** One locale by slug, or undefined. */
    get(slug: string): LocaleDef | undefined {
        return this.bySlug.get(slug);
    }

    /** The default locale (exactly one exists). */
    default(): LocaleDef {
        return this.defaultLocale;
    }

    /**
     * Resolve a request's locale slug: absent → the default; unknown → 400.
     * The uniform gate every request-facing path funnels through.
     */
    resolve(slug: string | undefined): LocaleDef {
        if (slug === undefined) return this.defaultLocale;
        const locale = this.bySlug.get(slug);
        if (!locale) {
            throw new BadRequestException(`Unknown locale "${slug}".`);
        }
        return locale;
    }
}
