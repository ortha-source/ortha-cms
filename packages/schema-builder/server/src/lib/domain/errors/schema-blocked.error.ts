import type { ClassifiedChange } from '@orthacms/schema-builder-domain';
import { SchemaBuilderError } from './schema-builder.error';

/** The draft holds a change this version of the builder does not apply. */
export class SchemaBlockedError extends SchemaBuilderError {
    readonly code = 'schema-builder.blocked';

    constructor(readonly changes: readonly ClassifiedChange[]) {
        super('Some changes cannot be applied. The review lists why.');
    }

    override details() {
        return {
            changes: this.changes.map(({ id, reason }) => ({ id, reason }))
        };
    }
}
