/**
 * `npx nx run server:dev:reset` — throw the dev database away and start again:
 *
 *   1. drop and recreate the database `DATABASE_URL` names;
 *   2. delete the local media blobs (`MEDIA_LOCAL_ROOT`, `./.storage/media`);
 *   3. apply every plugin's migrations (`server:db:migrate`);
 *   4. run the dev seed (`server:dev:seed`).
 *
 * `--restore-model` also puts `apps/server/src/content` and
 * `apps/server/migrations` back to what git has committed and clears the
 * schema builder's operation log — for after an experiment in the schema
 * builder. It discards uncommitted changes there, so it is opt-in.
 *
 * Refuses outside development: the whole point is to destroy a database.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const workspaceRoot = resolve(import.meta.dirname, '../../..');
const restoreModel = process.argv.includes('--restore-model');

if (process.env.NODE_ENV === 'production') {
    fail('refusing to reset with NODE_ENV=production.');
}
const url = process.env.DATABASE_URL;
if (!url) fail('DATABASE_URL is not set (it is read from the workspace .env).');

const target = new URL(url);
const database = decodeURIComponent(target.pathname.slice(1));
if (!database) fail(`DATABASE_URL names no database: ${url}`);
const host = target.hostname;
if (
    !['localhost', '127.0.0.1', '::1', 'postgres'].includes(host) &&
    process.env.ORTHACMS_ALLOW_REMOTE_RESET !== 'true'
) {
    fail(
        `DATABASE_URL points at "${host}", not a local database. Set ORTHACMS_ALLOW_REMOTE_RESET=true if you really mean it.`
    );
}

if (restoreModel) {
    step('restoring the content model from git');
    const paths = ['apps/server/src/content', 'apps/server/migrations'];
    execFileSync('git', ['checkout', 'HEAD', '--', ...paths], {
        cwd: workspaceRoot,
        stdio: 'inherit'
    });
    execFileSync('git', ['clean', '-fdq', '--', ...paths], {
        cwd: workspaceRoot,
        stdio: 'inherit'
    });
    rmSync(resolve(workspaceRoot, 'apps/server/.orthacms'), {
        recursive: true,
        force: true
    });
}

step(`recreating database "${database}"`);
const admin = new URL(url);
admin.pathname = '/postgres';
const client = new pg.Client({ connectionString: admin.toString() });
await client.connect();
try {
    const quoted = `"${database.replaceAll('"', '""')}"`;
    await client.query(
        'select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()',
        [database]
    );
    await client.query(`drop database if exists ${quoted}`);
    await client.query(`create database ${quoted}`);
} finally {
    await client.end();
}

const mediaRoot = resolve(
    workspaceRoot,
    process.env.MEDIA_LOCAL_ROOT || './.storage/media'
);
step(`clearing media blobs in ${mediaRoot}`);
rmSync(mediaRoot, { recursive: true, force: true });

run('server:db:migrate');
run('server:dev:seed');

function run(target) {
    step(`nx run ${target}`);
    const result = spawnSync('npx', ['nx', 'run', target, '--skip-nx-cache'], {
        cwd: workspaceRoot,
        stdio: 'inherit',
        env: process.env
    });
    if (result.status !== 0) fail(`${target} failed.`);
}

function step(message) {
    console.log(`\n▶ ${message}`);
}

function fail(message) {
    console.error(`[dev:reset] ${message}`);
    process.exit(1);
}
