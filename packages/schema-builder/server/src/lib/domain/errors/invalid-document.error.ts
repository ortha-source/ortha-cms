import { SchemaBuilderError } from './schema-builder.error';

/** The request body is not shaped like a schema document. */
export class InvalidDocumentError extends SchemaBuilderError {
    readonly code = 'schema-builder.invalid-document';

    constructor(readonly problems: readonly string[]) {
        super(`The document is malformed: ${problems.slice(0, 3).join('; ')}.`);
    }

    override details() {
        return { problems: this.problems };
    }
}
