const camel = (s: string) =>
    s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const pascal = (s: string) => camel(s).replace(/^./, (c) => c.toUpperCase());

/**
 * The manifest's export names. drizzle-kit keys tables by their SQL name, not
 * by the export, so renaming one never produces a migration — but keeping the
 * names hand-written manifests used means nothing that imports them breaks.
 */
export const tableExportName = (type: string): string => `${camel(type)}Table`;
export const joinExportName = (type: string, field: string): string =>
    `${camel(type)}${pascal(field)}JoinTable`;
export const REVISIONS_EXPORT = 'contentEntryRevisionsTable';
