import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ServerModule } from './server.module';
import type { CreateServerOptions } from './types/server-plugin';

/**
 * Bootstraps the Ortha CMS server: runs each plugin's `onPluginInit`
 * hook in order, imports every plugin's NestJS module, sets the global
 * prefix and a strict validation pipe, then listens.
 */
export async function createServer(
    options: CreateServerOptions
): Promise<void> {
    const { plugins, port = 3000, globalPrefix = 'api' } = options;

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

    await app.listen(port);
    Logger.log(
        `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
    );
}
