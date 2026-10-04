/** The first line of every file the schema builder writes. */
export const GENERATED_MARKER = '// @orthacms-generated';

/** Whether a file's first line says the builder owns it. */
export const isGeneratedSource = (
    firstLine: string | null | undefined
): boolean => (firstLine ?? '').trimStart().startsWith(GENERATED_MARKER);
