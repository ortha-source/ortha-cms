import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ServerModule } from '@ortha-cms/bootstrap-server';
import { getPool } from '@ortha-cms/database';
import type { Server } from 'node:http';
import { buildPlugins } from '../../../server/src/plugins';
import { buildTestConfig, type TestConfigOverrides } from './test-config';
import { resolveDatabaseUrl } from './db-url';

export interface TestApp {
    app: INestApplication;
    /** Raw HTTP server to hand to supertest: `request(harness.server)`. */
    server: Server;
}

/**
 * Boots the real server in-process against the e2e testcontainer and returns
 * it without listening on a fixed port — supertest drives `getHttpServer()`
 * directly. This mirrors `createServer` (same plugins via `buildPlugins`, same
 * global prefix and `ValidationPipe`) but stops at `app.init()`, so the only
 * difference from production is "init, don't listen". `app.init()` also runs
 * the `OnApplicationBootstrap` seeders (system roles), exactly as a real boot.
 *
 * Migrations are NOT run here — `global-setup` already migrated the shared
 * container once.
 */
export async function createTestApp(
    overrides: TestConfigOverrides = {}
): Promise<TestApp> {
    const plugins = buildPlugins(
        buildTestConfig(resolveDatabaseUrl(), overrides)
    );

    // Mirror createServer: plugin init hooks run before the app is created so
    // the database connection is open before any provider is instantiated.
    for (const plugin of plugins) {
        await plugin.onPluginInit?.();
    }

    const app = await NestFactory.create(ServerModule.forRoot(plugins), {
        logger: false
    });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true
        })
    );
    await app.init();

    return { app, server: app.getHttpServer() as Server };
}

/**
 * Tears down a harness: closes the Nest app and the database pool. Jest
 * isolates module registries per spec file, so the `@ortha-cms/database`
 * singleton pool is per-file — closing it here keeps the worker free of
 * open handles between files.
 */
export async function closeTestApp(harness: TestApp): Promise<void> {
    await harness.app.close();
    await getPool().end();
}
