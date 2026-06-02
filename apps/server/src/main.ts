import { createServer } from '@ortha-cms/bootstrap-server';
import { DatabasePlugin } from '@ortha-cms/database';
import { IdentityPlugin } from '@ortha-cms/identity-server';
import config from '../ortha.config';

createServer({
    plugins: [
        DatabasePlugin({ connectionString: config.database.url }),
        IdentityPlugin(config.plugins.identity)
    ],
    port: config.port,
    globalPrefix: config.globalPrefix
});
