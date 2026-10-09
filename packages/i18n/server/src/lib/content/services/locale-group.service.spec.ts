import { NotFoundException } from '@nestjs/common';
import type { AnyContentType } from '@orthacms/content-server';
import { LocaleGroupService } from './locale-group.service';

/**
 * `entryLocales` is the existence check behind `i18n_translations_get` and
 * both translation-proposal tools, all of which take the entry id straight
 * from the model. A malformed one used to reach Postgres as `id = 'my-post'`
 * on a `uuid` column — a cast error whose message names the SQL — where a
 * missing entry gets a plain 404.
 */
describe('LocaleGroupService.entryLocales with a malformed id', () => {
    it('answers the missing-entry 404 without querying', async () => {
        const db = {
            select: jest.fn(() => {
                throw new Error('a malformed id reached the database');
            })
        };
        const service = new LocaleGroupService(db as never, {} as never);
        const type = { name: 'article', i18n: true } as AnyContentType;

        const read = service.entryLocales(type, 'my-post', 'ws');

        await expect(read).rejects.toBeInstanceOf(NotFoundException);
        await expect(read).rejects.toThrow(
            'No entry "my-post" on content type "article".'
        );
        expect(db.select).not.toHaveBeenCalled();
    });
});
