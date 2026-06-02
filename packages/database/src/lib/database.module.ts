import { DynamicModule, Inject, Module } from '@nestjs/common';
import { getDatabase } from './utils/db';

/** Injection token for the Drizzle database instance. */
export const DATABASE_TOKEN = Symbol('DATABASE_TOKEN');

/**
 * Parameter decorator that injects the Drizzle database instance.
 */
export const InjectDatabase = (): ParameterDecorator => Inject(DATABASE_TOKEN);

/**
 * NestJS module that provides the Drizzle instance to the DI container.
 * Registered globally so any plugin module can inject the db without
 * importing this module. Must be created after {@link initDatabase}.
 */
@Module({})
export class DatabaseModule {
    /** Creates a global dynamic module providing the database instance. */
    static forRoot(): DynamicModule {
        return {
            module: DatabaseModule,
            global: true,
            providers: [
                {
                    provide: DATABASE_TOKEN,
                    useFactory: () => getDatabase()
                }
            ],
            exports: [DATABASE_TOKEN]
        };
    }
}
