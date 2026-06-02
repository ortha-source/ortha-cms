import { createServer } from '@ortha-cms/bootstrap-server';
import { AppModule } from './app/app.module';
import config from '../ortha.config';

createServer({
    plugins: [{ name: 'app', module: AppModule }],
    port: config.port,
    globalPrefix: config.globalPrefix
});
