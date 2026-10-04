import { SchemaBuilderError } from './schema-builder.error';

/** [schema-builder:I-05] Another apply holds the lock. */
export class ApplyInProgressError extends SchemaBuilderError {
    readonly code = 'schema-builder.busy';

    constructor() {
        super(
            'Another change to the content model is being applied. Wait for it to finish.'
        );
    }
}
