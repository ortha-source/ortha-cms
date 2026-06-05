import { dirname } from 'node:path';
import type { CreateNodesV2, TargetConfiguration } from '@nx/devkit';

/**
 * Infers database targets onto projects, the same way `@nx/js` infers
 * `typecheck` from a tsconfig:
 *
 * - a project with a `drizzle.config.ts` gets a cacheable `db:generate`
 * - a project with an `ortha.config.ts` (the host) gets `db:migrate`
 *
 * No per-project wiring — drop a config file and the target appears.
 */
export const createNodesV2: CreateNodesV2 = [
    '**/{drizzle.config.ts,ortha.config.ts}',
    async (configFiles) => {
        return configFiles.map((file) => {
            const projectRoot = dirname(file);
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
                      }
                  };

            return [file, { projects: { [projectRoot]: { targets } } }];
        });
    }
];
