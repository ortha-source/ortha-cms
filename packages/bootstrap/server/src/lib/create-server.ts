import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ServerModule } from './server.module';
import type { CreateServerOptions } from './types/server-plugin';
import { setupApiDocs } from './utils/setup-api-docs';

/**
 * Bootstraps the Ortha CMS server: runs each plugin's `onPluginInit`
 * hook in order, imports every plugin's NestJS module, applies the proxy
 * trust setting, sets the global prefix and a strict validation pipe,
 * generates the OpenAPI document and mounts the Scalar API reference, then
 * listens.
 */
export async function createServer(
    options: CreateServerOptions
): Promise<void> {
    const {
        plugins,
        port = 3000,
        globalPrefix = 'api',
        trustProxy,
        docs
    } = options;

    // Run plugin setup hooks in order, before the app is created — so a
    // plugin can open resources (e.g. a db connection) that its module's
    // providers depend on at instantiation time.
    for (const plugin of plugins) {
        await plugin.onPluginInit?.();
    }

    const app = await NestFactory.create<NestExpressApplication>(
        ServerModule.forRoot(plugins)
    );

    // Before anything reads `req.ip`. A plugin that rate-limits or audits by
    // client address (identity's login throttle, its session rows) is only as
    // correct as this setting, and Express ignores `X-Forwarded-For` until it
    // is made — so behind a proxy every caller would otherwise share one
    // address, and one bucket.
    if (trustProxy !== undefined) {
        app.set('trust proxy', trustProxy);
    }

    app.setGlobalPrefix(globalPrefix);
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true
        })
    );

    // After the prefix + pipe, so the document describes the real URLs; before
    // `listen`, so the reference is reachable the moment the port opens.
    setupApiDocs(app, plugins, docs, globalPrefix);

    await app.listen(port);
    Logger.log(
        `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
    );
}
