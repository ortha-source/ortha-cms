export type { Database, DatabasePluginConfig } from './lib/types';
export { initDatabase, getDatabase, getPool } from './lib/utils/db';
export { DatabasePlugin } from './lib/utils/database-plugin';
export type { DatabaseServerPlugin } from './lib/utils/database-plugin';
export {
    DatabaseModule,
    DATABASE_TOKEN,
    InjectDatabase
} from './lib/database.module';
