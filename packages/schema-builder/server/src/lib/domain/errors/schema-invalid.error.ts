import type { SchemaIssue } from '@orthacms/content-domain';
import { SchemaBuilderError } from './schema-builder.error';

/** The draft breaks a schema rule — the same rules the DSL runs at boot. */
export class SchemaInvalidError extends SchemaBuilderError {
    readonly code = 'schema-builder.invalid';

    constructor(readonly issues: readonly SchemaIssue[]) {
        super(issues[0]?.message ?? 'The content model breaks a schema rule.');
    }

    override details() {
        return { issues: this.issues };
    }
}
