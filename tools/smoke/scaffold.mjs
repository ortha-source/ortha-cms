/**
 * The first-run smoke test: what a stranger does after reading the README.
 *
 *     npx nx run-many -t pack          # stage every package under dist/pack/
 *     node tools/smoke/scaffold.mjs    # npm run smoke:scaffold does both
 *
 * Every unit and e2e suite in this repository runs against the workspace, where
 * packages resolve from source. None of them installs what npm would serve, so
 * none of them can see a generated app that does not boot: a template path that
 * moved, a tarball missing its migrations, a dependency only the monorepo
 * happened to hoist. This one does, and it does it the way a user would:
 *
 *   1. start a throwaway npm registry (Verdaccio) and publish the staged
 *      tarballs from `dist/pack/` into it — the `@orthacms` scope and the
 *      scaffolder are served from there only, everything else is proxied from
 *      npmjs, so the app installs exactly what a release would ship;
 *   2. `npx create-orthacms-app@<version> --yes` in a temporary directory
 *      **outside** the repository — inside it, Node's resolution would walk up
 *      into the workspace's `node_modules` and a broken tarball would pass;
 *   3. follow the generated README literally: `docker compose up`, `npm run
 *      migrate`, `npm test`, `npm run typecheck`, `npm run build`, `npm start`;
 *   4. check the running app over HTTP: the API answers, the root admin the
 *      `.env` provisions can sign in, and `/` serves the admin bundle.
 *
 * Needs Docker (for the app's own docker-compose Postgres, on :5432) and
 * network access to registry.npmjs.org. `--keep` leaves the generated app and
 * the database behind for inspection.
 */

import { spawn, spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync
} from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

const VERDACCIO = 'verdaccio@6.10.4';
const APP_NAME = 'smoke-app';
const BOOT_TIMEOUT_MS = 120_000;

const workspaceRoot = process.cwd();
const packRoot = join(workspaceRoot, 'dist', 'pack');
const keep = process.argv.includes('--keep');

const scaffolderManifest = join(
    packRoot,
    'packages',
    'create-orthacms-app',
    'package.json'
);
if (!existsSync(scaffolderManifest)) {
    fail(
        'dist/pack/ holds no staged create-orthacms-app — run ' +
            '`npx nx run-many -t pack` first.'
    );
}
const version = readJson(scaffolderManifest).version;

const work = mkdtempSync(join(tmpdir(), 'orthacms-smoke-'));
const appDir = join(work, APP_NAME);
const composeProject = `orthacms-smoke-${process.pid}`;
const cleanups = [];

try {
    const registry = await startRegistry();
    const env = registryEnv(registry.url, registry.token);

    step(`publish dist/pack/ to ${registry.url}`);
    await publishAll(registry.url, env);

    step(`npx create-orthacms-app@${version} ${APP_NAME} --yes`);
    run(
        'npx',
        ['-y', `create-orthacms-app@${version}`, APP_NAME, '--yes', '--no-git'],
        { cwd: work, env }
    );

    step('docker compose up -d');
    run('docker', ['compose', '-p', composeProject, 'up', '-d', '--wait'], {
        cwd: appDir,
        env
    });
    cleanups.push(() => {
        if (keep) return;
        spawnSync('docker', ['compose', '-p', composeProject, 'down', '-v'], {
            cwd: appDir,
            stdio: 'inherit'
        });
    });

    step('npm run migrate');
    run('npm', ['run', 'migrate'], { cwd: appDir, env });
    // Applying nothing on a migrated database is the other half of the
    // contract: a deploy runs `migrate` on every start.
    step('npm run migrate (again, nothing pending)');
    run('npm', ['run', 'migrate'], { cwd: appDir, env });

    step('npm test');
    run('npm', ['test'], { cwd: appDir, env });

    step('npm run typecheck');
    run('npm', ['run', 'typecheck'], { cwd: appDir, env });

    step('npm run build');
    run('npm', ['run', 'build'], { cwd: appDir, env });

    const port = await freePort();
    step(`npm start (PORT=${port})`);
    const server = startServer(port, env);
    cleanups.push(server.stop);

    await checkRunningApp(`http://127.0.0.1:${port}`, server);

    console.log(
        `\n✔ create-orthacms-app@${version} scaffolds an app that migrates, ` +
            'builds, boots and signs its admin in.'
    );
} catch (error) {
    console.error(`\n✖ ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
} finally {
    for (const cleanup of cleanups.reverse()) {
        try {
            await cleanup();
        } catch (error) {
            console.error(`cleanup: ${error}`);
        }
    }
    if (keep) {
        console.log(`\nKept the generated app at ${appDir}`);
    } else {
        rmSync(work, { recursive: true, force: true });
    }
}

/* -------------------------------------------------------------------------- */

/**
 * A Verdaccio that serves `@orthacms/*` and `create-orthacms-app` only from
 * what is published into it, and proxies everything else.
 *
 * No uplink on the two local patterns is the point: with one, a tarball this
 * run failed to publish would be fetched from npmjs instead, and the smoke test
 * would pass against the last release rather than this commit.
 */
async function startRegistry() {
    step(`start ${VERDACCIO}`);

    const dir = join(work, 'registry');
    const port = await freePort();
    const url = `http://127.0.0.1:${port}`;
    const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;
    const config = join(work, 'verdaccio.yaml');

    writeFileSync(
        config,
        [
            `storage: ${join(dir, 'storage')}`,
            'auth:',
            '  htpasswd:',
            `    file: ${join(dir, 'htpasswd')}`,
            'uplinks:',
            '  npmjs:',
            '    url: https://registry.npmjs.org/',
            '    timeout: 60s',
            '    maxage: 30m',
            ...(proxy ? [`https_proxy: ${proxy}`] : []),
            'packages:',
            "  '@orthacms/*':",
            '    access: $all',
            '    publish: $authenticated',
            "  'create-orthacms-app':",
            '    access: $all',
            '    publish: $authenticated',
            "  '**':",
            '    access: $all',
            '    publish: $authenticated',
            '    proxy: npmjs',
            'max_body_size: 200mb',
            'log: { type: stdout, format: pretty, level: error }',
            ''
        ].join('\n')
    );

    const child = spawn(
        'npx',
        ['-y', VERDACCIO, '--config', config, '--listen', `127.0.0.1:${port}`],
        { stdio: ['ignore', 'inherit', 'inherit'], detached: true }
    );
    cleanups.push(() => killGroup(child));

    await waitFor(
        async () => (await fetch(`${url}/-/ping`)).ok,
        60_000,
        'Verdaccio did not start',
        child
    );

    // Registering a user is how Verdaccio hands out a publish token.
    const response = await fetch(`${url}/-/user/org.couchdb.user:smoke`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'smoke', password: 'smoke-password' })
    });
    const { token } = await response.json();
    if (!token)
        fail(`Verdaccio refused to register a user (${response.status})`);

    return { url, token };
}

/**
 * The environment every npm and npx call runs in: this registry, a fresh cache
 * (a cached `create-orthacms-app@<version>` from npmjs would be the release,
 * not this commit) and a userconfig of its own, so the caller's `~/.npmrc` is
 * neither read nor written.
 */
function registryEnv(url, token) {
    const npmrc = join(work, '.npmrc');
    const host = url.replace(/^https?:/, '');
    writeFileSync(npmrc, `registry=${url}/\n${host}/:_authToken=${token}\n`);

    return {
        ...process.env,
        npm_config_userconfig: npmrc,
        npm_config_registry: `${url}/`,
        npm_config_cache: join(work, 'npm-cache'),
        npm_config_audit: 'false',
        npm_config_fund: 'false',
        npm_config_update_notifier: 'false'
    };
}

/** Publishes every staged package root under dist/pack/, a few at a time. */
async function publishAll(url, env) {
    const roots = stagedPackages(packRoot);
    const queue = [...roots];
    const failures = [];

    async function worker() {
        for (let root = queue.shift(); root; root = queue.shift()) {
            const result = await runAsync(
                'npm',
                [
                    'publish',
                    root,
                    '--registry',
                    `${url}/`,
                    '--access',
                    'public'
                ],
                { env }
            );
            if (result.code !== 0) {
                failures.push(
                    `${relative(workspaceRoot, root)}\n${result.output}`
                );
            }
        }
    }
    await Promise.all(Array.from({ length: 6 }, worker));

    if (failures.length > 0) {
        fail(
            `${failures.length} package(s) failed to publish:\n${failures.join('\n')}`
        );
    }
    console.log(`published ${roots.length} packages at ${version}`);
}

/** Every directory under `dir` that holds a publishable package.json. */
function stagedPackages(dir) {
    const manifest = join(dir, 'package.json');
    if (existsSync(manifest)) {
        return readJson(manifest).private ? [] : [dir];
    }
    return readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name !== 'node_modules')
        .flatMap((entry) => stagedPackages(join(dir, entry.name)));
}

/** `npm start` in its own process group, so stopping it stops Node too. */
function startServer(port, env) {
    let output = '';
    const child = spawn('npm', ['start'], {
        cwd: appDir,
        env: { ...env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true
    });
    for (const stream of [child.stdout, child.stderr]) {
        stream.on('data', (chunk) => {
            output += chunk;
            process.stdout.write(chunk);
        });
    }
    return {
        child,
        output: () => output,
        stop: () => killGroup(child)
    };
}

/**
 * What "it works" means for a first run, checked over HTTP only — no database
 * reads, no imports from the app — so the test cannot pass by knowing more
 * than a user would.
 */
async function checkRunningApp(base, server) {
    await waitFor(
        async () => (await fetch(`${base}/api/auth/me`)).status === 401,
        BOOT_TIMEOUT_MS,
        'the server did not answer GET /api/auth/me within two minutes',
        server.child
    );

    step('GET /api/auth/me without a session → 401');
    // Proven by the wait above; named here so the log reads as a checklist.

    const env = parseEnv(readFileSync(join(appDir, '.env'), 'utf8'));
    const email = env.ORTHACMS_ROOT_ADMIN_EMAIL;
    const password = env.ORTHACMS_ROOT_ADMIN_PASSWORD;
    if (!email || !password) {
        fail('the generated .env provisions no root admin');
    }

    step(`POST /api/auth/login as ${email}`);
    const login = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    expect(login.ok, `login answered ${login.status}: ${await login.text()}`);
    const cookie = login.headers
        .getSetCookie()
        .map((header) => header.split(';')[0])
        .join('; ');
    expect(cookie.length > 0, 'login set no session cookie');

    step('GET /api/auth/me with the session → the root admin');
    const me = await fetch(`${base}/api/auth/me`, { headers: { cookie } });
    const meBody = await me.text();
    expect(me.status === 200, `/api/auth/me answered ${me.status}: ${meBody}`);
    expect(
        meBody.toLowerCase().includes(email.toLowerCase()),
        `/api/auth/me does not name ${email}: ${meBody}`
    );

    step('GET / → the admin bundle');
    const index = await fetch(`${base}/`);
    const html = await index.text();
    expect(index.status === 200, `/ answered ${index.status}`);
    expect(
        /<script[^>]+type="module"/.test(html),
        `/ is not the built admin:\n${html.slice(0, 400)}`
    );
}

/* -------------------------------------------------------------------------- */

function step(title) {
    console.log(`\n▶ ${title}`);
}

function expect(condition, message) {
    if (!condition) fail(message);
}

function fail(message) {
    throw new Error(message);
}

function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}

/** `KEY=value` lines, ignoring comments; enough for the generated .env. */
function parseEnv(text) {
    return Object.fromEntries(
        text
            .split('\n')
            .map((line) => /^\s*([A-Z0-9_]+)=(.*)$/.exec(line))
            .filter(Boolean)
            .map(([, key, value]) => [
                key,
                value.trim().replace(/^(['"])(.*)\1$/, '$2')
            ])
    );
}

function run(command, args, options) {
    const result = spawnSync(command, args, { stdio: 'inherit', ...options });
    if (result.status !== 0) {
        fail(
            `\`${command} ${args.join(' ')}\` exited with ${result.status ?? result.signal}`
        );
    }
}

function runAsync(command, args, options) {
    return new Promise((resolve) => {
        let output = '';
        const child = spawn(command, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            ...options
        });
        child.stdout.on('data', (chunk) => (output += chunk));
        child.stderr.on('data', (chunk) => (output += chunk));
        child.on('close', (code) => resolve({ code, output }));
    });
}

/** Polls `probe` until it returns true, failing early if `child` exits. */
async function waitFor(probe, timeoutMs, message, child) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (child && child.exitCode !== null) {
            fail(`${message}: the process exited with ${child.exitCode}`);
        }
        try {
            if (await probe()) return;
        } catch {
            // Not listening yet.
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    fail(message);
}

function killGroup(child) {
    if (child.exitCode !== null || child.pid === undefined) return;
    try {
        process.kill(-child.pid, 'SIGTERM');
    } catch {
        // Already gone.
    }
}

function freePort() {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.unref();
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
    });
}
