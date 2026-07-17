import { DynamicModule, Inject, Module } from '@nestjs/common';
import { getDatabase } from './utils/db';
import { DOMAIN_EVENT_SUBSCRIBERS } from './events/domain-event';
import { UnitOfWork } from './uow/unit-of-work';
import { OutboxWriter } from './outbox/outbox-writer';
import { OutboxDispatcher } from './outbox/outbox-dispatcher';

/** Injection token for the Drizzle database instance. */
export const DATABASE_TOKEN = Symbol('DATABASE_TOKEN');

/**
 * Parameter decorator that injects the Drizzle database instance.
 */
export const InjectDatabase = (): ParameterDecorator => Inject(DATABASE_TOKEN);

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
