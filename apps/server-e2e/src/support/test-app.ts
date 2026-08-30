import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ServerModule, setupApiDocs } from '@orthacms/bootstrap-server';
import { closeDatabase } from '@orthacms/database';
import type { Server } from 'node:http';
import { buildTestPlugins } from './plugins';
import { buildTestConfig, type TestConfigOverrides } from './test-config';
import { resolveDatabaseUrl } from './db-url';
import {
    assertDatabaseReachable,
    withDatabaseDiagnostics
} from './infra-error';

export interface TestApp {
    app: INestApplication;
    /** Raw HTTP server to hand to supertest: `request(harness.server)`. */
    server: Server;
}

/**
 * Boots the real server in-process against the e2e testcontainer and returns
 * it without listening on a fixed port — supertest drives `getHttpServer()`
 * directly. This mirrors `createServer` (same plugins via `buildTestPlugins`,
 * same global prefix, `ValidationPipe` and `setupApiDocs`) but stops at
 * `app.init()`, so the only differences from production are "init, don't
 * listen" and the silenced logger. `app.init()` also runs the
 * `OnApplicationBootstrap` seeders (system roles), exactly as a real boot.
 *
 * Migrations are NOT run here — `global-setup` already migrated the shared
 * container once.
 */
export async function createTestApp(
    overrides: TestConfigOverrides = {}
): Promise<TestApp> {
    const config = buildTestConfig(resolveDatabaseUrl(), overrides);
    const plugins = buildTestPlugins(config, {
        localMediaRoot: overrides.localMediaRoot,
        signingProvider: overrides.directServe === 'signed-url',
        ssoProviders: overrides.ssoProviders,
        omitContent: overrides.omitContent
    });

    return withDatabaseDiagnostics('booting the test app', () =>
        bootTestApp(config, plugins)
    );
}

async function bootTestApp(
    config: ReturnType<typeof buildTestConfig>,
    plugins: ReturnType<typeof buildTestPlugins>
): Promise<TestApp> {
    // Mirror createServer: plugin init hooks run before the app is created so
    // the database connection is open before any provider is instantiated.
    for (const plugin of plugins) {
        await plugin.onPluginInit?.();
    }

    // One `SELECT 1` before Nest instantiates a single provider. If the shared
    // container has died, this is where the run says so — rather than whichever
    // bootstrap seeder happened to notice first, reported as that suite's own
    // failure.
    await assertDatabaseReachable();

    // Silent by default — 70 suites each booting an app would otherwise bury the
    // report under Nest's start-up banner. `E2E_LOG=1` puts the real logger
    // back, which is the only way to see *why* a request 500ed: the
    // `ExceptionsHandler` line carries the failing query and the driver's own
    // message, and without it a suite can only report the status code. A
    // `malformed array literal` from a hand-written SQL fragment is exactly that
    // shape — invisible in the assertion, one line long in the log.
    const app = await NestFactory.create<NestExpressApplication>(
        ServerModule.forRoot(plugins),
        { logger: process.env['E2E_LOG'] ? undefined : false }
    );
    // Mirrors `createServer`, and before anything reads `req.ip`: the login
    // throttle buckets on it, so a suite that asserts per-client limiting has
    // to boot with the same proxy trust a real deployment configures.
    if (config.trustProxy !== undefined) {
        app.set('trust proxy', config.trustProxy);
    }
    // Mirrors `createServer`: an explicit body cap, rather than express's
    // inherited 100 kB. Registered here as well so a suite can assert the
    // boundary — the number is a decision now, and a decision nothing checks
    // is one a refactor can silently drop.
    app.useBodyParser('json', { limit: config.bodyLimit });
    app.useBodyParser('urlencoded', {
        limit: config.bodyLimit,
        extended: true
    });

    app.setGlobalPrefix('api');
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true
        })
    );

    // After the prefix + pipe, exactly as `createServer` does it, so a suite can
    // assert the reference is mounted when `docsEnabled` is on and absent when
    // it is off — the production-parity claim that used to be untestable
    // because the harness skipped this call entirely. A no-op (returns `null`)
    // for every suite that leaves docs disabled, which is all but one.
    setupApiDocs(app, plugins, config.docs, 'api');

    await app.init();

    return { app, server: app.getHttpServer() as Server };
}

/**
 * Tears down a harness: closes the Nest app and the database pool. Jest
 * isolates module registries per spec file, so the `@orthacms/database`
 * singleton pool is per-file — closing it here keeps the worker free of
 * open handles between files.
 *
 * `closeDatabase` rather than `getPool().end()`: ending the pool alone leaves
 * `initDatabase`'s memo populated, so a *second* `createTestApp` in the same
 * file would silently reuse the ended pool and every query would throw "Cannot
 * use a pool after calling end on the pool".
 */
export async function closeTestApp(harness: TestApp): Promise<void> {
    await harness.app.close();
    await closeDatabase();
}
