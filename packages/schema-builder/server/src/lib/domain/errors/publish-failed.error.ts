import { SchemaBuilderError } from './schema-builder.error';

/**
 * The migration committed but `src/content/` could not be written. The
 * database is ahead of the code; the backup of the folder is kept for a
 * person to put back.
 */
export class PublishFailedError extends SchemaBuilderError {
    readonly code = 'schema-builder.publish-failed';

    constructor(
        readonly backup: string,
        cause: string
    ) {
        super(
            `The migration was applied, but the content files could not be written (${cause}). Their backup is in ${backup}.`
        );
    }

    override details() {
        return { backup: this.backup };
    }
}
