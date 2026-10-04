import { SchemaBuilderError } from './schema-builder.error';

/**
 * drizzle-kit wanted to ask whether something was renamed. The builder
 * generates removals and additions separately so this cannot happen; reaching
 * it means a diff the phases did not split, and is reported rather than hung.
 */
export class MigrationAmbiguityError extends SchemaBuilderError {
    readonly code = 'schema-builder.migration-ambiguous';

    constructor(readonly output: string) {
        super(
            'drizzle-kit could not tell a rename from a drop and an add, so no migration was generated.'
        );
    }

    override details() {
        return { output: this.output };
    }
}
