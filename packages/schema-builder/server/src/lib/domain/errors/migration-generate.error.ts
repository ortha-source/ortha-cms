import { SchemaBuilderError } from './schema-builder.error';

/** drizzle-kit failed, timed out, or wrote nothing it should have. */
export class MigrationGenerateError extends SchemaBuilderError {
    readonly code = 'schema-builder.migration-failed';

    constructor(readonly output: string) {
        super(
            'drizzle-kit could not generate the migration. Its output is attached.'
        );
    }

    override details() {
        return { output: this.output };
    }
}
