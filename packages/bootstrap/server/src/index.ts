export { createServer } from './lib/create-server';
export { ServerModule } from './lib/server.module';
export { setupApiDocs } from './lib/utils/setup-api-docs';
export type {
    ServerPlugin,
    CreateServerOptions
} from './lib/types/server-plugin';
export type { ApiDocsOptions } from './lib/types/api-docs';
export type {
    ApiSecurityScheme,
    PluginApiDocs
} from './lib/types/plugin-api-docs';
