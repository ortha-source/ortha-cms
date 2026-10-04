import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderManifest } from '@orthacms/schema-builder-domain';
import { scanContentDir, type ModuleLoader } from './scan-content-dir';

export interface SyncResult {
    /** Types written to the manifest. */
    count: number;
    /** False when the file on disk already said exactly this. */
    changed: boolean;
}

/**
 * Rebuilds `<contentDir>/index.ts` from the type modules beside it. Shared by
 * `orthacms content sync` and the Nx `content:sync` target — one implementation,
 * two ways to load TypeScript.
 */
export async function syncContentManifest(
    contentDir: string,
    load: ModuleLoader
): Promise<SyncResult> {
    if (!existsSync(contentDir)) {
        throw new Error(
            `${contentDir} does not exist — create collections/ or pages/ under it first.`
        );
    }
    const { entries, problems } = await scanContentDir(contentDir, load);
    if (problems.length) {
        throw new Error(
            `content sync stopped:\n  - ${problems.join('\n  - ')}`
        );
    }
    const target = join(contentDir, 'index.ts');
    const next = renderManifest(entries);
    const changed =
        !existsSync(target) || readFileSync(target, 'utf8') !== next;
    if (changed) writeFileSync(target, next);
    return { count: entries.length, changed };
}
