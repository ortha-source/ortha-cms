import {
    Inject,
    Injectable,
    Optional,
    type OnApplicationBootstrap
} from '@nestjs/common';
import { InjectContentRegistry } from '../content.tokens';
import type { ContentTypeRegistry } from '../registry/content-type-registry';
import {
    CONTENT_ENTRY_EXTENSION,
    type ContentEntryExtension
} from './entry-extension';

/**
 * Fails boot when a registered content type declares `i18n: true` but no
 * {@link ContentEntryExtension} is bound. Without an extension nothing stamps
 * the NOT NULL `locale` column, so the first create would 500 — a clear boot
 * error ("register the i18n plugin") beats a broken first request.
 */
@Injectable()
export class EntryExtensionBootCheck implements OnApplicationBootstrap {
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        @Optional()
        @Inject(CONTENT_ENTRY_EXTENSION)
        private readonly extension?: ContentEntryExtension
    ) {}

    onApplicationBootstrap(): void {
        if (this.extension) return;
        const orphaned = this.registry
            .all()
            .filter((type) => type.i18n)
            .map((type) => `"${type.name}"`);
        if (orphaned.length) {
            throw new Error(
                `Content type(s) ${orphaned.join(', ')} declare i18n: true, but no ` +
                    `CONTENT_ENTRY_EXTENSION is bound. Register a localization plugin ` +
                    `(e.g. I18nServerPlugin) after ContentPlugin, or drop the flag.`
            );
        }
    }
}
