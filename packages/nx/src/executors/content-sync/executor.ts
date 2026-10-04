import { join } from 'node:path';
import type { ExecutorContext } from '@nx/devkit';
import { syncContentManifest } from '@orthacms/cli';
import { createTsJiti } from '../../lib/jiti';

/** Options for the `content-sync` executor. */
export interface ContentSyncExecutorOptions {
    /** The host's content folder, relative to the workspace root. */
    contentDir: string;
}

/**
 * Rewrites the host's `src/content/index.ts` from its type modules — the same
 * implementation `orthacms content sync` runs, loading TypeScript from source
 * through the swc-backed jiti the other executors use.
 */
export default async function contentSyncExecutor(
    options: ContentSyncExecutorOptions,
    context: ExecutorContext
): Promise<{ success: boolean }> {
    const contentDir = join(context.root, options.contentDir);
    const jiti = createTsJiti(join(context.root, 'package.json'));
    const { count, changed } = await syncContentManifest(contentDir, (path) =>
        jiti.import<Record<string, unknown>>(path)
    );
    console.log(
        changed
            ? `content sync: ${count} type(s) → ${options.contentDir}/index.ts`
            : `content sync: ${options.contentDir}/index.ts is already up to date (${count} type(s))`
    );
    return { success: true };
}
