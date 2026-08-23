import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';

/**
 * Runs `drizzle-kit generate` against a plugin's static drizzle config.
 * Generation only diffs the schema against the stored snapshot — it never
 * touches the database, so no credentials are involved.
 *
 * Runs with `cwd` set to the plugin's project root, because drizzle-kit
 * resolves the config's `schema`/`out` paths relative to the working
 * directory (not the config file's location).
 */
export function runDrizzleKitGenerate(
    cwd: string,
    config: string,
    name?: string
): void {
    // drizzle-kit's `exports` map blocks resolving `./bin.cjs` directly, so
    // resolve the package's main entry and locate the sibling bin.
    const bin = join(dirname(require.resolve('drizzle-kit')), 'bin.cjs');
    const args = [bin, 'generate', `--config=${config}`];
    if (name) {
        args.push(`--name=${name}`);
    }

    try {
        execFileSync(process.execPath, args, { cwd, stdio: 'inherit' });
    } catch (error) {
        // `execFileSync` throws an Error whose message is the whole argv —
        // node's path, drizzle-kit's bin path, every flag — which Nx then
        // prints as a multi-frame stack. drizzle-kit has already said what was
        // wrong on the inherited stdio just above; the useful thing to add is
        // which project failed, not a second copy of the command.
        const status = (error as { status?: number | null } | null)?.status;

        throw new Error(
            `drizzle-kit generate failed in ${cwd}` +
                (typeof status === 'number' ? ` (exit ${status})` : '') +
                ` — its output is above. Check ${config}'s \`schema\` paths and ` +
                `that the schema files compile.`,
            { cause: error }
        );
    }
}
