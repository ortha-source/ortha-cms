#!/usr/bin/env node
import { buildCommand } from './lib/commands/build';
import { devCommand } from './lib/commands/dev';
import { generateCommand } from './lib/commands/generate';
import { migrateCommand } from './lib/commands/migrate';
import { startCommand } from './lib/commands/start';
import { studioCommand } from './lib/commands/studio';
import { loadEnv } from './lib/env';
import { findProjectRoot } from './lib/project';

const USAGE = `ortha — the Ortha CMS command line

Usage: ortha <command> [options]

Commands:
  dev                    Run the API and admin dev servers together
  build                  Compile the server and build the admin bundle
  start                  Run the built server
  migrate                Apply every plugin's pending migrations
  generate [--name=<n>]  Generate a migration for this app's content tables
  studio [--host --port] Open Drizzle Studio on this app's database

Options:
  --server               build/dev: the server only, skipping the admin
  --admin                build: the admin bundle only
  -h, --help             Show this message
`;

/** Reads `--flag=value`, or `--flag value`, from argv. */
function option(argv: readonly string[], name: string): string | undefined {
    const inline = argv.find((arg) => arg.startsWith(`--${name}=`));
    if (inline) return inline.slice(`--${name}=`.length);

    const index = argv.indexOf(`--${name}`);
    const next = index === -1 ? undefined : argv[index + 1];

    return next && !next.startsWith('-') ? next : undefined;
}

/** Whether a bare `--flag` is present. */
function flag(argv: readonly string[], name: string): boolean {
    return argv.includes(`--${name}`);
}

async function main(): Promise<void> {
    const [command, ...argv] = process.argv.slice(2);

    if (!command || flag(argv, 'help') || argv.includes('-h')) {
        console.log(USAGE);
        return;
    }

    const root = findProjectRoot();

    // Before any command runs, so `ortha.config.ts` finds its settings and the
    // processes `dev`/`start` spawn inherit them.
    loadEnv(root);

    switch (command) {
        case 'dev':
            return devCommand(root);
        case 'build':
            return buildCommand(root, {
                serverOnly: flag(argv, 'server'),
                adminOnly: flag(argv, 'admin')
            });
        case 'start':
            return startCommand(root);
        case 'migrate':
            return migrateCommand(root);
        case 'generate':
            return generateCommand(root, option(argv, 'name'));
        case 'studio': {
            const port = option(argv, 'port');
            return studioCommand(root, {
                host: option(argv, 'host'),
                port: port ? Number(port) : undefined
            });
        }
        default:
            console.error(`Unknown command "${command}".\n`);
            console.log(USAGE);
            process.exitCode = 1;
    }
}

main().catch((error: unknown) => {
    // The message, not the stack. Every throw reaching here is a condition the
    // user can act on — an unbuilt app, a missing DATABASE_URL, a failed
    // migration naming the plugin — and a stack trace buries the sentence that
    // says which.
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
