/**
 * The constants this plugin's UI is keyed on.
 *
 * Permission keys are string literals rather than an import from an identity
 * package, matching how the other admin plugins spell theirs: the admin's
 * `useHasPermission` takes a key, and duplicating the two strings the server
 * already owns is cheaper than a dependency for two strings.
 */

/** Permission to take content out of the workspace in bulk. */
export const CONTENT_EXPORT = 'content:export';
/** Permission to write content in from a file. */
export const CONTENT_IMPORT = 'content:import';
/** Needed alongside import — an import may never exceed what its caller could do. */
export const CONTENT_CREATE = 'content:create';
export const CONTENT_UPDATE = 'content:update';

/** Stable slot-item ids, so a contribution can be found in a registry dump. */
export const SLOT_ITEM_ID = {
    ExportEntry: 'transfer.export.entry',
    ExportSelection: 'transfer.export.selection',
    Import: 'transfer.import'
} as const;

/** Where the entry-menu item sorts within the Extras group. */
export const EXPORT_MENU_ORDER = 30;

/** TanStack Query keys owned by this plugin. */
export const transferKeys = {
    all: ['transfer'] as const,
    exportPreview: (
        typeName: string,
        ids: readonly string[],
        depth: Record<string, boolean>,
        format: string
    ) =>
        [
            'transfer',
            'export-preview',
            typeName,
            format,
            // Sorted, so the same selection made in a different click order is
            // one cache entry rather than two.
            [...ids].sort(),
            depth
        ] as const
};
