import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

type Manifest = { name?: string; bin?: string | Record<string, string> };

/**
 * The folder of `pkg` as `from` resolves it. Found from the main entry upward,
 * because not every package exports its `package.json` (drizzle-kit does not).
 */
function packageRoot(from: string, pkg: string): string {
    let dir = dirname(createRequire(from).resolve(pkg));
    while (dir !== dirname(dir)) {
        const manifest = join(dir, 'package.json');
        if (
            existsSync(manifest) &&
            (JSON.parse(readFileSync(manifest, 'utf8')) as Manifest).name ===
                pkg
        )
            return dir;
        dir = dirname(dir);
    }
    throw new Error(`Found ${pkg} but not its package.json.`);
}

/**
 * A package's CLI entry, resolved from the **app** first — its own drizzle-kit
 * and prettier are the versions its scripts run — then from the working
 * directory (a monorepo root that hoisted them), and read from the manifest's
 * `bin` field. Never a bare `require.resolve`, which the server's bundler
 * would rewrite.
 */
export function resolvePackageBin(
    projectRoot: string,
    pkg: string,
    command: string
): string {
    for (const from of [
        join(projectRoot, 'package.json'),
        join(process.cwd(), 'package.json')
    ]) {
        try {
            const root = packageRoot(from, pkg);
            const { bin } = JSON.parse(
                readFileSync(join(root, 'package.json'), 'utf8')
            ) as Manifest;
            const entry = typeof bin === 'string' ? bin : bin?.[command];
            if (entry) return join(root, entry);
        } catch {
            // Not installed there; try the next place.
        }
    }
    throw new Error(`${pkg} is not installed — the schema builder needs it.`);
}
