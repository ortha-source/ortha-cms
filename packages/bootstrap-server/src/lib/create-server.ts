import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ServerModule } from './server.module';
import type { CreateServerOptions } from './types/server-plugin';

/**
 * Bootstraps the Ortha CMS server: imports every plugin's NestJS module,
 * sets the global prefix and a strict validation pipe, then listens.
 */
export async function createServer(
    options: CreateServerOptions
): Promise<void> {
    const { plugins, port = 3000, globalPrefix = 'api' } = options;

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
