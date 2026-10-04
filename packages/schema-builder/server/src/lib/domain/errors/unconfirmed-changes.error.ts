import { SchemaBuilderError } from './schema-builder.error';

/** [schema-builder:I-07] A destructive change reached apply without its own confirmation. */
export class UnconfirmedChangesError extends SchemaBuilderError {
    readonly code = 'schema-builder.unconfirmed';

    constructor(readonly changeIds: readonly string[]) {
        super(
            `Confirm each change that deletes data before applying: ${changeIds.join(', ')}.`
        );
    }

    override details() {
        return { changeIds: this.changeIds };
    }
}
