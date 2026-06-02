import { createServer } from '@ortha-cms/bootstrap-server';
import { DatabasePlugin } from '@ortha-cms/database';
import config from '../ortha.config';

createServer({
    plugins: [DatabasePlugin({ connectionString: config.database.url })],
    port: config.port,
    globalPrefix: config.globalPrefix
});
