import { SchemaBuilderError } from './schema-builder.error';

/** The draft changes a type whose file was written by hand (ADR-0020 §3). */
export class NotBuilderOwnedError extends SchemaBuilderError {
    readonly code = 'schema-builder.not-owned';

    constructor(readonly types: readonly string[]) {
        super(
            `${types.join(', ')} ${types.length === 1 ? 'is' : 'are'} written by hand. ` +
                'Edit the file, or add the generated marker to its first line to hand it over.'
        );
    }

    override details() {
        return { types: this.types };
    }
}
