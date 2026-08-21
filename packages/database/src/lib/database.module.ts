import { DynamicModule, Module } from '@nestjs/common';
import { getDatabase } from './utils/db';
import { DATABASE_TOKEN } from './database.tokens';
import { DOMAIN_EVENT_SUBSCRIBERS } from './events/domain-event';
import { UnitOfWork } from './uow/unit-of-work';
import { OutboxWriter } from './outbox/outbox-writer';
import { OutboxDispatcher } from './outbox/outbox-dispatcher';

// Re-exported so the historical `@orthacms/database` barrel specifier
// (`export { ..., DATABASE_TOKEN, InjectDatabase } from './lib/database.module'`)
// stays valid; the definitions live in the dependency-free tokens module to
// avoid an initialization cycle with the primitives below.
export { DATABASE_TOKEN, InjectDatabase } from './database.tokens';

/**
 * NestJS module that provides the Drizzle instance to the DI container,
 * plus the shared tactical-DDD primitives — {@link UnitOfWork},
 * {@link OutboxWriter}, {@link OutboxDispatcher}. Registered globally so any
 * plugin module can inject them without importing this module. Must be
 * created after {@link initDatabase}.
 */
@Module({})
export class DatabaseModule {
    /** Creates a global dynamic module providing the database + primitives. */
    static forRoot(): DynamicModule {
        return {
            module: DatabaseModule,
            global: true,
            providers: [
                {
                    provide: DATABASE_TOKEN,
                    useFactory: () => getDatabase()
                },
                // Default to an empty array so injection never fails before a
                // plugin contributes subscribers. Downstream plugins register
                // at runtime via `OutboxDispatcher.register(...)`.
                {
                    provide: DOMAIN_EVENT_SUBSCRIBERS,
                    useValue: []
                },
                UnitOfWork,
                OutboxWriter,
                OutboxDispatcher
            ],
            exports: [
                DATABASE_TOKEN,
                UnitOfWork,
                OutboxWriter,
                OutboxDispatcher
            ]
        };
    }
}
