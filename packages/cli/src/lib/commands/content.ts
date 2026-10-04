import { join } from 'node:path';
import { createJiti } from 'jiti';
import { syncContentManifest } from '../content/sync-content-manifest';
import { LAYOUT } from '../project';

/**
 * `orthacms content sync` — rewrites `src/content/index.ts` from the files under
 * `collections/` and `pages/`. Type modules import only the decorator-free
 * `@orthacms/content-server/define`, so plain jiti loads them.
 */
export async function contentCommand(
    root: string,
    argv: readonly string[]
): Promise<void> {
    const [sub] = argv;
    if (sub !== 'sync') {
        throw new Error(
            `Unknown content command "${sub ?? ''}". Did you mean \`orthacms content sync\`?`
        );
    }
    const jiti = createJiti(join(root, 'package.json'), { moduleCache: false });
    const { count, changed } = await syncContentManifest(
        join(root, LAYOUT.contentDir),
        (path) => jiti.import<Record<string, unknown>>(path)
    );
    console.log(
        changed
            ? `content sync: ${count} type(s) → ${LAYOUT.contentDir}/index.ts`
            : `content sync: ${LAYOUT.contentDir}/index.ts is already up to date (${count} type(s))`
    );
}
