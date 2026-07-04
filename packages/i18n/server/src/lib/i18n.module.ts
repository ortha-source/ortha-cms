import { DynamicModule, Module } from '@nestjs/common';
import { CONTENT_ENTRY_EXTENSION } from '@ortha-cms/content-server';
import { I18N_CONFIG } from './i18n.constants';
import type { I18nPluginConfig } from './types/locale';
import { LocaleRegistryService } from './locales/services/locale-registry.service';
import { ListLocalesController } from './locales/controllers/list-locales.controller';
import { EntryLocaleExtensionService } from './content/services/entry-locale-extension.service';
import { LocaleGroupService } from './content/services/locale-group.service';
import { TranslationService } from './content/services/translation.service';
import { GetEntryLocalesController } from './content/controllers/get-entry-locales.controller';
import { LocaleSummaryController } from './content/controllers/locale-summary.controller';
import { CreateTranslationController } from './content/controllers/create-translation.controller';

/**
 * NestJS module of the i18n plugin. Registered **global** so its binding of
 * content-server's `CONTENT_ENTRY_EXTENSION` port resolves inside the
 * (equally global) content module without an explicit import — the same
 * inversion as content binding identity's `CONTENT_CATALOG`, roles swapped:
 * content declares the port, this plugin provides the implementation.
 */
@Module({})
export class I18nModule {
    /** Creates the global dynamic module around a validated config. */
    static forRoot(config: I18nPluginConfig): DynamicModule {
        return {
            module: I18nModule,
            global: true,
            controllers: [
                ListLocalesController,
                GetEntryLocalesController,
                // Literal `locale-summary` occupies the `:id` slot of the
                // translations route's pattern — registered before the
                // `:id`-parameterized controller so the literal wins (the
                // `ParseUUIDPipe` on `:id` is the backstop).
                LocaleSummaryController,
                CreateTranslationController
            ],
            providers: [
                { provide: I18N_CONFIG, useValue: config },
                LocaleRegistryService,
                LocaleGroupService,
                TranslationService,
                EntryLocaleExtensionService,
                {
                    provide: CONTENT_ENTRY_EXTENSION,
                    useExisting: EntryLocaleExtensionService
                }
            ],
            exports: [CONTENT_ENTRY_EXTENSION, LocaleRegistryService]
        };
    }
}
