/**
 * The Content Library's **extension slots** — the named seams another admin
 * plugin (e.g. `@ortha-cms/i18n-admin`) contributes UI and behavior into,
 * with no coupling beyond these contracts. Mirrors the workspace shell's
 * `WORKSPACE_SIDEBAR_SLOT` idiom: this package declares and renders the
 * slots; contributors register items via their `AdminPlugin.slots`.
 *
 * **Hook-style items** (`useRowsData`, `useFields`): the render sites call
 * these inside a loop over `slot.getItems()`. That is rules-of-hooks-safe
 * ONLY because slot registration is boot-frozen — `createAdmin` registers
 * every contribution once, before the first render, and the list never
 * changes afterwards — so the call order is stable across renders. The render
 * sites call every registered item's hook on every render (never behind a
 * condition); an item must gate its own fetching internally (e.g. TanStack
 * Query `enabled`) rather than expect to be skipped.
 */

import type { ComponentType } from 'react';
import type { MessageDescriptor } from 'react-intl';
import { createSlot } from '@ortha-cms/utils-admin';
import type { FilterField } from '@ortha-cms/query-builder-admin';
import type {
    ContentTypeDetail,
    EntryRecord
} from '../../types/contentType';
import type { EntryMode } from '../../constants';

/** Context handed to a {@link RecordsToolbarItem}'s component. */
export type RecordsToolbarContext = {
    /** The open collection's full schema. */
    schema: ContentTypeDetail;
    /** The open workspace's id. */
    workspaceId: string;
    /**
     * Current URL values of this item's {@link RecordsToolbarItem.listParamKeys},
     * keyed by param name (undefined = absent).
     */
    params: Record<string, string | undefined>;
    /**
     * Merge params into the URL (undefined deletes a key) and reset the page —
     * the same semantics as the search/filter controls.
     */
    updateParams: (next: Record<string, string | undefined>) => void;
};

/** One records-toolbar contribution (e.g. a locale switcher). */
export type RecordsToolbarItem = {
    /** Stable id (used as the React key). */
    id: string;
    /**
     * URL query params this item owns. Their current values are forwarded to
     * the records list request verbatim (and ride the query key), and are
     * handed back via {@link RecordsToolbarContext.params}.
     */
    listParamKeys?: string[];
    /** The control to render in the records toolbar's actions row. */
    Component: ComponentType<RecordsToolbarContext>;
};

/**
 * Toolbar add-ons in the collection records view, rendered in the toolbar's
 * actions row (after the column picker and filters).
 */
export const RECORDS_TOOLBAR_SLOT = createSlot<RecordsToolbarItem>(
    'content.records.toolbar'
);

/** Context handed to a {@link RecordsColumnItem}'s cell. */
export type RecordsColumnCellContext = {
    /** The row's record. */
    entry: EntryRecord;
    /** Whatever this item's {@link RecordsColumnItem.useRowsData} returned. */
    data: unknown;
    /** Absolute path to the open type (`/workspaces/:id/content/:typeName`). */
    typePath: string;
};

/** One extension table column (e.g. a per-record locales overview). */
export type RecordsColumnItem = {
    /** Stable id — also the column id in the picker. Must not collide with a field name. */
    id: string;
    /** Column header / picker label. */
    label: MessageDescriptor;
    /** Whether the column applies to this type (drives its picker presence). */
    appliesTo: (schema: ContentTypeDetail) => boolean;
    /**
     * Optional hook run once per records-table render with the current page's
     * rows — the place to batch-load per-page data (one request per page, not
     * per row). Called for **every** registered item on every render (see the
     * module JSDoc); gate fetching internally when not applicable.
     */
    useRowsData?: (
        entries: EntryRecord[],
        schema: ContentTypeDetail,
        workspaceId: string
    ) => unknown;
    /** The cell renderer. */
    Cell: ComponentType<RecordsColumnCellContext>;
};

/**
 * Extension columns for the collection records table. An applicable column
 * joins the column picker like any schema column (toggle + reorder), hidden
 * by default. Extension columns are not sortable (the server's sort
 * whitelist doesn't know them).
 */
export const RECORDS_COLUMN_SLOT = createSlot<RecordsColumnItem>(
    'content.records.columns'
);

/**
 * Context handed to entry-editor slot items — the sidebar widgets and the
 * relation picker's param contributions. Assembled by `ContentEntryView`.
 */
export type EntrySlotContext = {
    /** The open type's full schema. */
    schema: ContentTypeDetail;
    /** The record being edited; undefined while creating. */
    entry?: EntryRecord;
    /** Whether the editor is a blank create form. */
    isCreate: boolean;
    /** Which editor mode is open (create / edit / single). */
    mode: EntryMode;
    /** The open workspace's id. */
    workspaceId: string;
    /** Absolute path to the open type (`/workspaces/:id/content/:typeName`). */
    typePath: string;
    /**
     * Current URL values of the {@link ENTRY_PARAMS_SLOT} keys (list +
     * create-body), keyed by param name (`undefined` when absent). Opaque — a
     * slot reads only its own keys (e.g. i18n scopes the relation picker by its
     * `locale` even on a create form, where there's no saved `entry`).
     */
    params: Record<string, string | undefined>;
};

/** One entry-sidebar widget contribution (a card in the right rail). */
export type EntrySidebarWidgetItem = {
    /** Stable id (used as the React key). */
    id: string;
    /** The widget, rendered below the Details block. */
    Component: ComponentType<EntrySlotContext>;
};

/** Card blocks appended to the entry editor's right rail. */
export const ENTRY_SIDEBAR_WIDGET_SLOT = createSlot<EntrySidebarWidgetItem>(
    'content.entry.sidebar'
);

/** One entry-header contribution (an inline element beside the editor title). */
export type EntryHeaderItem = {
    /** Stable id (used as the React key). */
    id: string;
    /** Rendered in the title row, to the right of the `<h1>` (e.g. a chip). */
    Component: ComponentType<EntrySlotContext>;
};

/**
 * Inline add-ons in the entry editor's title row, rendered after the `<h1>`
 * (e.g. the i18n plugin's current-locale chip). The heading stays the sole
 * `<h1>`; contributions are siblings beside it.
 */
export const ENTRY_HEADER_SLOT = createSlot<EntryHeaderItem>(
    'content.entry.header'
);

/** One filter-fields contribution for the records query-builder drawer. */
export type RecordsFilterFieldsItem = {
    /** Stable id. */
    id: string;
    /**
     * Hook returning extra {@link FilterField}s for the type, appended after
     * the schema-derived ones. Return `[]` when not applicable. Called for
     * every registered item on every render (see the module JSDoc).
     */
    useFields: (schema: ContentTypeDetail) => FilterField[];
};

/** Extra query-builder filter fields for the records view. */
export const RECORDS_FILTER_FIELDS_SLOT = createSlot<RecordsFilterFieldsItem>(
    'content.records.filterFields'
);

/**
 * Non-visual param plumbing for the entry editor. Lets a contributor thread
 * its own wire params through flows this package owns, without owning any UI
 * in them.
 */
export type EntryParamsItem = {
    /** Stable id. */
    id: string;
    /**
     * URL query params forwarded to the **single**-mode one-entry read (a
     * single resolves its row via the list endpoint; these scope that read).
     */
    listParamKeys?: string[];
    /**
     * URL query params copied verbatim into the **create** body. Each key
     * must be declared on the server's `SaveEntryDto` — the strict
     * ValidationPipe rejects unknown body keys.
     */
    createBodyKeys?: string[];
    /**
     * Extra list params for a relation picker's candidate query (e.g. scope
     * candidates to the source entry's locale). Return `{}` to add nothing.
     */
    relationCandidateParams?: (
        targetSchema: ContentTypeDetail,
        source: EntrySlotContext
    ) => Record<string, string>;
};

/** Entry-editor param plumbing contributions. */
export const ENTRY_PARAMS_SLOT = createSlot<EntryParamsItem>(
    'content.entry.params'
);
