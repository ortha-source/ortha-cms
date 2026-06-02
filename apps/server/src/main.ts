import { createServer } from '@ortha-cms/bootstrap-server';
import { AppModule } from './app/app.module';

createServer({
    plugins: [{ name: 'app', module: AppModule }],
    port: Number(process.env.PORT) || 3000
});
