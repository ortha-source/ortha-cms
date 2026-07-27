import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ServerModule } from './server.module';
import { docsEnabled } from './utils/docs-document';
import { mountDocs } from './utils/mount-docs';
import type { CreateServerOptions } from './types/server-plugin';

/**
 * Bootstraps the Ortha CMS server: runs each plugin's `onPluginInit`
 * hook in order, imports every plugin's NestJS module, sets the global
 * prefix and a strict validation pipe, mounts the API reference, then listens.
 */
export async function createServer(
    options: CreateServerOptions
): Promise<void> {
    const { plugins, port = 3000, globalPrefix = 'api', docs } = options;

    // Run plugin setup hooks in order, before the app is created — so a
    // plugin can open resources (e.g. a db connection) that its module's
    // providers depend on at instantiation time.
    for (const plugin of plugins) {
        await plugin.onPluginInit?.();
    }

    const app = await NestFactory.create(ServerModule.forRoot(plugins));

    app.setGlobalPrefix(globalPrefix);
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true
        })
    );

    // After the prefix + pipe, so the generated document reflects the routes as
    // they are actually mounted (`/api/...`), and before `listen` so the
    // reference is available the moment the port opens.
    if (docsEnabled(docs)) {
        mountDocs(app, globalPrefix, docs ?? {});
    }

    await app.listen(port);
    Logger.log(
        `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
    );
}
