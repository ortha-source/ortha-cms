import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { LAYOUT } from '../project';
import { spawnNode, superviseUntilExit, tscBin, viteBin } from '../run';
import { buildCommand } from './build';

/**
 * The development stack in one terminal: `tsc --watch`, `node --watch` on the
 * compiled entry, and the Vite dev server.
 *
 * The one-shot build first is load-bearing, not tidiness. `node --watch`
 * **cannot recover from a missing entry point** — handed a path that does not
 * exist yet, it stays alive watching nothing and never boots, which reads as a
 * server that hung rather than one started a second too early. So `dist/` is
 * populated before the watchers race for it. (The monorepo solves the same
 * problem with a separate `dev:prebuild` target; see the root AGENTS.md.)
 */
export async function devCommand(root: string): Promise<void> {
    await buildCommand(root, { serverOnly: true });

    const children = [
        // `--preserveWatchOutput` stops tsc clearing the screen on every
        // recompile, which otherwise wipes the Nest logs sharing this terminal.
        spawnNode(
            [
                tscBin(root),
                '-p',
                LAYOUT.serverTsconfig,
                '--watch',
                '--preserveWatchOutput'
            ],
            root
        ),
        spawnNode(['--watch', join(root, LAYOUT.serverEntry)], root)
    ];

    if (existsSync(join(root, 'index.html'))) {
        children.push(spawnNode([viteBin(root)], root));
    }

    await superviseUntilExit(children);
}
