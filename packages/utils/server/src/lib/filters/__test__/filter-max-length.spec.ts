import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FILTER_MAX_LENGTH } from '../budgets';

/**
 * `FILTER_MAX_LENGTH` was declared four times, and one copy disagreed.
 *
 * `activity`, `content` and `users` each said 4096; `alarms` said **8192**,
 * under a doc comment claiming it used "the same layering
 * `activity.constants.ts` uses" — the file that says 4096. Nothing imported the
 * alarms copy and nothing could have: `@MaxLength` is a string decorator and
 * that package's `filter` field is an object. So the divergence was never even
 * a divergence in behaviour; it was a number nobody could reconcile, which is
 * how four declarations of one rule fail. The value now lives once, in
 * `budgets.ts`, beside the engine that enforces the rest of the filter's
 * limits, and the three packages that need it re-export it.
 *
 * A re-export is identity, so asserting the three constants are equal would be
 * a test that cannot fail. What *can* come back is a fifth declaration: a new
 * filterable plugin writing its own `export const FILTER_MAX_LENGTH = …`
 * because that is what the neighbouring plugin appears to do. That is what this
 * checks, by reading the source — no import, and therefore no project-graph
 * edge from this package to every server plugin in the workspace (`utils:I-01`:
 * the leaf does not import its consumers).
 */
const PACKAGES_DIR = join(__dirname, '../../../../../..');

/** Directories that hold build output or dependencies rather than source. */
const SKIP = new Set(['node_modules', 'dist', 'out-tsc', 'test-output']);

/** Every `.ts` file under `packages/`, excluding build output and specs. */
function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            return SKIP.has(entry.name) || entry.name === '__test__'
                ? []
                : sourceFiles(path);
        }
        if (!entry.name.endsWith('.ts') || entry.name.endsWith('.d.ts'))
            return [];
        return /\.(spec|test)\.ts$/.test(entry.name) ? [] : [path];
    });
}

describe('the filter length cap is one number', () => {
    it('is declared in exactly one place', () => {
        const declarations = sourceFiles(PACKAGES_DIR)
            .filter((file) =>
                /export const FILTER_MAX_LENGTH\s*(:[^=]+)?=/.test(
                    readFileSync(file, 'utf8')
                )
            )
            .map((file) => file.slice(PACKAGES_DIR.length + 1));

        expect(declarations).toEqual([
            join('utils', 'server', 'src', 'lib', 'filters', 'budgets.ts')
        ]);
    });

    it('is the value the three re-exporting packages had agreed on', () => {
        // Not a tautology over the re-exports — a statement about which of the
        // two numbers survived. `alarms`' 8192 was the outlier and the one that
        // was never applied; raising the shared cap to it would have widened
        // three endpoints to match a guard that did not exist.
        expect(FILTER_MAX_LENGTH).toBe(4096);
    });
});
