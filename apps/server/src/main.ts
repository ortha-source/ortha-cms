import { createServer } from '@ortha-cms/bootstrap-server';
import config from '../ortha.config';
import { buildPlugins } from './plugins';

createServer({
    plugins: buildPlugins(config),
    port: config.port,
    globalPrefix: config.globalPrefix
});
