import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { collection } from '../collection/define';
import { CONTENT_REGISTRY } from '../content.tokens';
import { field } from '../fields';
import { ContentTypeRegistry } from '../registry/content-type-registry';
import { CONTENT_ENTRY_EXTENSION } from './entry-extension';
import { EntryExtensionBootCheck } from './entry-extension-boot-check';

/**
 * A type declaring `i18n: true` needs somebody to stamp the NOT NULL `locale`
 * column, and only a bound {@link CONTENT_ENTRY_EXTENSION} does that. Without
 * one the application comes up *looking* healthy and 500s on the first create,
 * which is the failure this check exists to convert into a boot error naming
 * the missing plugin.
 *
 * **The container has to do the work.** The dependency is
 * `@Optional() @Inject(CONTENT_ENTRY_EXTENSION)` and the trigger is
 * `OnApplicationBootstrap`; `new EntryExtensionBootCheck(registry)` followed by
 * a hand call to `onApplicationBootstrap()` succeeds whether or not either
 * decorator is present, so it would pin neither "no extension bound is a
 * *legal* state to resolve" nor "the throw actually aborts boot". So these go
 * through `Test.createTestingModule(...).init()`, which runs the same hook
 * Nest runs on a real application.
 */
describe('EntryExtensionBootCheck', () => {
    const localized = collection('article', {
        i18n: true,
        fields: { title: field.text() }
    });
    const alsoLocalized = collection('page', {
        i18n: true,
        fields: { title: field.text() }
    });
    const plain = collection('author', {
        fields: { name: field.text() }
    });

    /**
     * Boots a container holding the check over `registry`, with an extension
     * bound under the real token or not bound at all.
     */
    async function bootstrap(
        registry: ContentTypeRegistry,
        extension?: unknown
    ): Promise<void> {
        const moduleRef = await Test.createTestingModule({
            providers: [
                EntryExtensionBootCheck,
                { provide: CONTENT_REGISTRY, useValue: registry },
                ...(extension
                    ? [
                          {
                              provide: CONTENT_ENTRY_EXTENSION,
                              useValue: extension
                          }
                      ]
                    : [])
            ]
        }).compile();
        await moduleRef.init();
        await moduleRef.close();
    }

    it('aborts boot, naming every orphaned type [content:I-03]', async () => {
        // Two localized types and one plain one: the message must name both of
        // the first and neither the second, so a check that reported only the
        // first orphan — or every type it saw — fails here.
        const registry = new ContentTypeRegistry([
            localized,
            plain,
            alsoLocalized
        ]);

        await expect(bootstrap(registry)).rejects.toThrow(
            /Content type\(s\) "article", "page" declare i18n: true, but no CONTENT_ENTRY_EXTENSION is bound/
        );
    });

    it('comes up when the extension is bound [content:I-03]', async () => {
        // The complement. Without it the case above would also pass against a
        // check that threw unconditionally — and `@Optional()` means "no
        // extension is a resolvable state", so a bound one has to be the
        // difference rather than a second way to fail.
        const registry = new ContentTypeRegistry([
            localized,
            plain,
            alsoLocalized
        ]);

        await expect(
            bootstrap(registry, { name: 'i18n' })
        ).resolves.toBeUndefined();
    });

    it('comes up with no extension when no type is localized [content:I-03]', async () => {
        // The other half of "optional": an installation that localizes nothing
        // must not be forced to install a localization plugin.
        await expect(
            bootstrap(new ContentTypeRegistry([plain]))
        ).resolves.toBeUndefined();
    });

    it('is registered with the module that boots it [content:I-03]', () => {
        // The check is inert unless ContentModule provides it — Nest only calls
        // `onApplicationBootstrap` on instances it holds. Every assertion above
        // constructs its own container, so none of them can see this.
        const module = readFileSync(
            join(__dirname, '../content.module.ts'),
            'utf8'
        );
        const providers = module
            .split('providers:')[1]
            ?.split('exports:')[0] as string | undefined;

        expect(providers).toBeDefined();
        expect(providers).toContain('EntryExtensionBootCheck');
    });
});
