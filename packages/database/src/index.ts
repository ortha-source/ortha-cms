export type { Database, DatabasePluginConfig } from './lib/types';
export { initDatabase, getDatabase, getPool } from './lib/utils/db';
export { DatabasePlugin } from './lib/utils/database-plugin';
export type { DatabaseServerPlugin } from './lib/utils/database-plugin';
export {
    DatabaseModule,
    DATABASE_TOKEN,
    InjectDatabase
} from './lib/database.module';
export {
    createDomainEvent,
    attachActor,
    DOMAIN_EVENT_SUBSCRIBERS
} from './lib/events/domain-event';
export type {
    DomainEvent,
    CreateDomainEventParams,
    DomainEventSubscriber,
    EventActor
} from './lib/events/domain-event';
export { UnitOfWork } from './lib/uow/unit-of-work';
export { OutboxWriter } from './lib/outbox/outbox-writer';
export { OutboxDispatcher } from './lib/outbox/outbox-dispatcher';
export { outboxEvents } from './lib/schema';
