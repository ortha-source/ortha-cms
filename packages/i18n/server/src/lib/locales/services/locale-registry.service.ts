import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { I18N_CONFIG } from '../../i18n.constants';
import type { I18nPluginConfig, LocaleDef } from '../../types/locale';
import { LocalePolicy } from '../../domain/locale-policy';
import { UnknownLocaleError } from '../../domain/errors';
import type { Locale } from '../../domain/value-objects/locale';
import { LocaleSet } from '../../domain/value-objects/locale-set';

/** Maps a domain {@link Locale} back to the plain wire/config shape. */
function toDef(locale: Locale): LocaleDef {
    return {
        slug: locale.slug,
        name: locale.name,
        isDefault: locale.isDefault
    };
}

/**
 * Read access to the validated locale configuration — the runtime authority
 * every other i18n service consults. It wraps the domain {@link LocaleSet} /
 * {@link LocalePolicy} (rebuilt from the already-validated config), so every
 * service resolves locales through the same domain rule; it exposes the plain
 * {@link LocaleDef} shape its callers expect and maps the domain's
 * {@link UnknownLocaleError} to HTTP 400.
 */
@Injectable()
export class LocaleRegistryService {
    private readonly locales: LocaleSet;
    private readonly policy: LocalePolicy;

    constructor(@Inject(I18N_CONFIG) config: I18nPluginConfig) {
        this.locales = LocaleSet.fromDefs(config.locales);
        this.policy = new LocalePolicy(this.locales);
    }

    /** All configured locales, in config (display) order. */
    all(): LocaleDef[] {
        return this.locales.all().map(toDef);
    }

    /** One locale by slug, or undefined. */
    get(slug: string): LocaleDef | undefined {
        const locale = this.locales.get(slug);
        return locale ? toDef(locale) : undefined;
    }

    /** The default locale (exactly one exists). */
    default(): LocaleDef {
        return toDef(this.locales.default());
    }

    /**
     * Resolve a request's locale slug: absent → the default; unknown → 400.
     * The uniform gate every request-facing path funnels through.
     */
    resolve(slug: string | undefined): LocaleDef {
        try {
            return toDef(this.policy.resolve(slug));
        } catch (error) {
            if (error instanceof UnknownLocaleError) {
                throw new BadRequestException(error.message);
            }
            throw error;
        }
    }
}
