import { Injectable } from '@nestjs/common';
import {
    createDomainEvent,
    OutboxWriter,
    UnitOfWork
} from '@orthacms/database';
import type {
    SchemaAppliedFacts,
    SchemaAudit
} from '../../domain/ports/schema-audit.port';

/** The event kind an apply records. */
export const SCHEMA_APPLIED = 'schema.applied';

/**
 * {@link SchemaAudit} through the transactional outbox, like every other
 * domain event: one `schema.applied` per apply, its aggregate the operation.
 * Its own unit of work — drizzle's migrator commits on its own, so the event
 * follows the commit rather than sharing it.
 */
@Injectable()
export class OutboxSchemaAudit implements SchemaAudit {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly outbox: OutboxWriter
    ) {}

    applied(facts: SchemaAppliedFacts): Promise<void> {
        return this.uow.run(() =>
            this.outbox.append([
                createDomainEvent({
                    kind: SCHEMA_APPLIED,
                    aggregateType: 'schema',
                    aggregateId: facts.operationId,
                    payload: { ...facts }
                })
            ])
        );
    }
}
