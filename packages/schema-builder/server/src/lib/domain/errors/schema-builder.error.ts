/**
 * The base of every error the builder answers with a body of its own:
 * a stable `code` the admin switches on, a sentence, and the details that
 * explain it. The HTTP filter maps each subclass to one status.
 */
export abstract class SchemaBuilderError extends Error {
    abstract readonly code: string;

    /** What the response carries besides the code and the message. */
    details(): Record<string, unknown> {
        return {};
    }
}
