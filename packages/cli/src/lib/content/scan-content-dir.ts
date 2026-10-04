import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ManifestEntry } from '@orthacms/schema-builder-domain';
import { readManifestEntry } from './read-manifest-entry';

/** Imports one TypeScript module — jiti in the CLI, swc-backed jiti in Nx. */
export type ModuleLoader = (path: string) => Promise<Record<string, unknown>>;

export interface ScanResult {
    entries: ManifestEntry[];
    problems: string[];
}

const FOLDERS = ['collections', 'pages'] as const;

const isTypeModule = (file: string) =>
    file.endsWith('.ts') &&
    !file.endsWith('.spec.ts') &&
    !file.endsWith('.d.ts');

/** Every content type module under `collections/` and `pages/`, read through `load`. */
export async function scanContentDir(
    dir: string,
    load: ModuleLoader
): Promise<ScanResult> {
    const entries: ManifestEntry[] = [];
    const problems: string[] = [];
    for (const folder of FOLDERS) {
        const path = join(dir, folder);
        if (!existsSync(path)) continue;
        for (const file of readdirSync(path).filter(isTypeModule).sort()) {
            const result = readManifestEntry(
                folder,
                file,
                await load(join(path, file))
            );
            if ('entry' in result) entries.push(result.entry);
            else problems.push(result.problem);
        }
    }
    return { entries, problems };
}
