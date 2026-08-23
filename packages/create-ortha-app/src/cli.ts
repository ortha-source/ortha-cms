#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { ask } from './lib/prompt';
import { isNonEmptyDirectory, renderTemplate } from './lib/template';
import {
    databaseNameFrom,
    validateAppName,
    validateDatabaseUrl
} from './lib/validate';

const USAGE = `create-ortha-app — scaffold an Ortha CMS app

Usage: npx create-ortha-app <directory> [options]

Options:
  --yes            Accept every default, asking nothing
  --no-install     Skip installing dependencies
  --no-git         Skip initialising a git repository
  -h, --help       Show this message
`;

/** Whether a bare `--flag` is present. */
function flag(argv: readonly string[], name: string): boolean {
    return argv.includes(`--${name}`);
}

/**
 * This package's own version, which every `@orthacms/*` dependency in the
 * generated app is pinned to.
 *
 * The scaffolder is released in lockstep with the packages it scaffolds, so
 * its version *is* the matching set — which is the whole mechanism keeping a
 * generated app internally consistent. Reading it from the manifest rather
 * than resolving `latest` from the registry also means `npx
 * create-ortha-app@0.3.0` generates a 0.3.0 app, not whatever shipped since.
 */
function ownVersion(): string {
    const manifest = join(__dirname, '../package.json');
    return (JSON.parse(readFileSync(manifest, 'utf8')) as { version: string })
        .version;
}

/** Runs a command in `cwd`, returning whether it succeeded. */
function runCommand(command: string, args: string[], cwd: string): boolean {
    const result = spawnSync(command, args, {
        cwd,
        stdio: 'inherit',
        shell: process.platform === 'win32'
    });
    return result.status === 0;
}

async function main(): Promise<void> {
    const argv = process.argv.slice(2);

    if (flag(argv, 'help') || argv.includes('-h')) {
        console.log(USAGE);
        return;
    }

    const positional = argv.filter((arg) => !arg.startsWith('-'));
    const target = resolve(positional[0] ?? '.');

    if (isNonEmptyDirectory(target)) {
        throw new Error(
            `${target} already exists and is not empty. Pick a new directory, ` +
                `or empty that one first.`
        );
    }

    const defaultName = basename(target);
    // `--yes`, or anything non-interactive: a scaffolder that blocks on a
    // prompt in CI hangs the job until it times out.
    const interactive = !flag(argv, 'yes') && process.stdin.isTTY === true;

    const answers = await ask(
        {
            appName: {
                label: 'App name',
                fallback: defaultName,
                validate: validateAppName
            },
            databaseUrl: {
                label: 'Database URL',
                fallback: `postgresql://ortha:ortha@localhost:5432/${defaultName.replace(/[^a-z0-9_]/gi, '_')}`,
                validate: validateDatabaseUrl
            },
            adminEmail: {
                label: 'Admin email',
                fallback: 'admin@example.com'
            }
        },
        interactive
    );

    const appName = answers['appName'] ?? defaultName;
    const databaseUrl = answers['databaseUrl'] ?? '';
    // Generated rather than prompted: a password typed at a scaffold prompt is
    // echoed to the terminal and lands in shell history. This one is written
    // only to the git-ignored .env and printed once, below.
    const adminPassword = randomBytes(12).toString('base64url');

    mkdirSync(target, { recursive: true });

    console.log(`\nCreating an Ortha CMS app in ${target}…`);

    renderTemplate(join(__dirname, '../templates/default'), target, {
        appName,
        appTitle: appName,
        databaseUrl,
        databaseName: databaseNameFrom(databaseUrl),
        adminEmail: answers['adminEmail'] ?? 'admin@example.com',
        adminPassword,
        orthaVersion: ownVersion()
    });

    if (!flag(argv, 'no-git') && !existsSync(join(target, '.git'))) {
        runCommand('git', ['init', '--quiet'], target);
    }

    const installed =
        flag(argv, 'no-install') ||
        (console.log('\nInstalling dependencies…'),
        runCommand('npm', ['install', '--no-audit', '--no-fund'], target));

    if (!installed) {
        console.error(
            '\nDependency installation failed. Fix the error above, then run ' +
                '`npm install` in the new directory.'
        );
        process.exitCode = 1;
    }

    console.log(
        [
            '',
            `Done. Your admin account is ${answers['adminEmail']} / ${adminPassword}`,
            '(also written to .env — it is created on first boot, then never touched again).',
            '',
            'Next:',
            `  cd ${basename(target)}`,
            ...(flag(argv, 'no-install') ? ['  npm install'] : []),
            '  docker compose up -d',
            '  npm run migrate',
            '  npm run dev',
            ''
        ].join('\n')
    );
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
