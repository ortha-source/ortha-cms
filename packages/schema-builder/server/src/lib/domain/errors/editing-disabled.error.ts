import type { ReadOnlyReason } from '@orthacms/schema-builder-domain';
import { SchemaBuilderError } from './schema-builder.error';

/** [schema-builder:I-01] This server may not change the content model. */
export class EditingDisabledError extends SchemaBuilderError {
    readonly code = 'schema-builder.disabled';

    constructor(readonly reason: ReadOnlyReason) {
        super(
            'Editing the content model is available only in development, with SCHEMA_BUILDER=true.'
        );
    }

    override details() {
        return { reason: this.reason };
    }
}
