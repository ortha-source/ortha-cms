import { execFile } from 'node:child_process';
import type { CodeFormatter } from '../../domain/ports/code-formatter.port';
import { resolvePackageBin } from '../node-bin/resolve-package-bin';

/** Long enough for a cold start; formatting one file takes a fraction of it. */
const TIMEOUT_MS = 20_000;

/**
 * {@link CodeFormatter} over the app's own prettier CLI, given the file's real
 * path so it resolves the project's configuration — a generated file is
 * formatted the way the project's format check expects and never appears in a
 * diff on its own. A child process rather than prettier's API: the API's
 * CommonJS entry is an `import()` shim, and this keeps the app's version in
 * charge.
 */
export class PrettierFormatter implements CodeFormatter {
    constructor(private readonly root: string) {}

    format(source: string, path: string): Promise<string> {
        const bin = resolvePackageBin(this.root, 'prettier', 'prettier');
        return new Promise((resolve, reject) => {
            const child = execFile(
                process.execPath,
                [bin, '--stdin-filepath', path],
                { cwd: this.root, timeout: TIMEOUT_MS, maxBuffer: 8 << 20 },
                (error, stdout, stderr) =>
                    error
                        ? reject(
                              new Error(
                                  `prettier could not format ${path}: ${stderr || error.message}`
                              )
                          )
                        : resolve(stdout)
            );
            child.stdin?.end(source);
        });
    }
}
