import { SchemaBuilderError } from './schema-builder.error';

/** The draft was made against a content model this process no longer serves. */
export class StaleDocumentError extends SchemaBuilderError {
    readonly code = 'schema-builder.stale';

    constructor(readonly currentFingerprint: string) {
        super(
            'The content model changed since you opened it. Reload it and make the change again.'
        );
    }

    override details() {
        return { currentFingerprint: this.currentFingerprint };
    }
}
