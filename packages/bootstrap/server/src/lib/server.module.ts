import { DynamicModule, Module } from '@nestjs/common';
import type { ServerPlugin } from './types/server-plugin';

/**
 * Root NestJS module. {@link ServerModule.forRoot} builds a dynamic
 * module that imports every plugin's module.
 */
@Module({})
export class ServerModule {
    /** Creates a dynamic root module importing all plugin modules. */
    static forRoot(plugins: ServerPlugin[]): DynamicModule {
        return {
            module: ServerModule,
            imports: plugins.map((plugin) => plugin.module)
        };
    }
}
