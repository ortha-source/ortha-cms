import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { CreateNodesV2, TargetConfiguration } from '@nx/devkit';

/**
 * Infers database and release targets onto projects, the same way `@nx/js`
 * infers `typecheck` from a tsconfig:
 *
 * - a project with a `drizzle.config.ts` gets a cacheable `db:generate`
 * - a project with an `ortha.config.ts` (the host) gets `db:migrate` and
 *   `db:studio`
 * - a package under `packages/` gets `build`, and a publishable one also
 *   gets `pack` plus an `nx-release-publish` pointed at what `pack` staged
 *
 * No per-project wiring — drop a config file and the target appears.
 */
export const createNodesV2: CreateNodesV2 = [
    '**/{drizzle.config.ts,ortha.config.ts,package.json}',
    async (configFiles, _, context) => {
        return configFiles.map((file) => {
            const projectRoot = dirname(file);

            if (file.endsWith('package.json')) {
                const targets = packageTargets(
                    projectRoot,
                    file,
                    context.workspaceRoot
                );
                return [
                    file,
                    targets ? { projects: { [projectRoot]: { targets } } } : {}
                ];
            }

            const isDrizzleConfig = file.endsWith('drizzle.config.ts');

            const targets: Record<string, TargetConfiguration> = isDrizzleConfig
                ? {
                      'db:generate': {
                          executor: '@ortha-cms/nx:db-generate',
                          options: {
                              cwd: projectRoot,
                              config: 'drizzle.config.ts'
                          },
                          cache: true,
                          inputs: ['{projectRoot}/src/lib/schema/**/*'],
                          outputs: ['{projectRoot}/migrations']
                      }
                  }
                : {
                      'db:migrate': {
                          executor: '@ortha-cms/nx:db-migrate',
                          options: {
                              config: file,
                              plugins: `${projectRoot}/src/plugins.ts`
                          },
                          cache: false
                      },
                      'db:studio': {
                          executor: '@ortha-cms/nx:db-studio',
                          options: {
                              config: file
                          },
                          cache: false
                      }
                  };

            return [file, { projects: { [projectRoot]: { targets } } }];
        });
    }
];

/**
 * Compile and release targets for one package under `packages/`.
 *
 * `@nx/js/typescript` infers `build` only for a project whose manifest
 * points at its **output**; ours point at `./src/index.ts`, because
 * workspace packages are consumed from source (AGENTS.md, "How packages
 * resolve"). That is the right trade for development and the wrong one for
 * npm, so the compile step is inferred here instead: `tsc --build` against
 * the package's `tsconfig.lib.json`, which emits JS and declarations into
 * `dist/` and builds its project references on the way.
 *
 * A publishable package gets two more targets. `pack` stages a publishable
 * package root under `dist/pack/` (see `tools/release/pack.mjs`), and
 * `nx-release-publish` is redirected at that directory rather than the
 * project root — the checked-in manifest is never what ships.
 *
 * Returns `undefined` for anything outside `packages/`; the apps build
 * through their own bundlers.
 */
function packageTargets(
    projectRoot: string,
    file: string,
    workspaceRoot: string
): Record<string, TargetConfiguration> | undefined {
    if (!projectRoot.startsWith('packages/')) return undefined;

    let manifest: { name?: string; private?: boolean };

    try {
        manifest = JSON.parse(readFileSync(join(workspaceRoot, file), 'utf8'));
    } catch {
        return undefined;
    }

    if (!manifest.name) return undefined;
    if (!existsSync(join(workspaceRoot, projectRoot, 'tsconfig.lib.json'))) {
        return undefined;
    }

    const targets: Record<string, TargetConfiguration> = {
        build: {
            executor: 'nx:run-commands',
            options: {
                command: 'tsc --build tsconfig.lib.json --pretty',
                cwd: projectRoot
            },
            dependsOn: ['^build'],
            cache: true,
            inputs: ['production', '^production'],
            outputs: ['{projectRoot}/dist']
        }
    };

    // This plugin is workspace tooling, not a distributable.
    if (manifest.private) return targets;

    return {
        ...targets,
        pack: {
            executor: 'nx:run-commands',
            options: {
                command: `node tools/release/pack.mjs ${projectRoot}`
            },
            dependsOn: ['build'],
            // Cheap, and it reads `dist` — which is not one of its declared
            // inputs — so a cache hit would happily restore a stale tarball.
            cache: false,
            outputs: [`{workspaceRoot}/dist/pack/${projectRoot}`]
        },
        // `dependsOn` is deliberately absent: Nx installs its own default for
        // this target after inference and would overwrite it. It lives in
        // `nx.json`'s `targetDefaults` instead.
        'nx-release-publish': {
            executor: '@nx/js:release-publish',
            options: { packageRoot: `dist/pack/${projectRoot}` }
        }
    };
}
