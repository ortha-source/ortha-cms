import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { generatedFiles } from './generated';

/**
 * `.env.example`, the scaffolder's `env.tmpl` and `docs/configuration.md` are
 * rendered from the catalog. Edit the catalog, then run
 * `ORTHACMS_WRITE_GENERATED=1 npx nx test config` to rewrite them; this spec
 * fails while any of them is stale, which is what keeps a variable from being
 * documented in one place and forgotten in another.
 */
describe('files generated from the catalog', () => {
    const root = join(__dirname, '../../../..');
    const write = process.env['ORTHACMS_WRITE_GENERATED'] === '1';

    for (const [path, content] of Object.entries(generatedFiles())) {
        it(`${path} is up to date`, () => {
            const file = join(root, path);
            if (write) {
                writeFileSync(file, content);
            }
            expect(readFileSync(file, 'utf8')).toBe(content);
        });
    }
});
