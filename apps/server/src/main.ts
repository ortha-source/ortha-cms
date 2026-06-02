import { createServer } from '@ortha-cms/bootstrap-server';
import config from '../ortha.config';

createServer({
    plugins: [],
    port: config.port,
    globalPrefix: config.globalPrefix
});
