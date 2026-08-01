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

import type { ComponentType, ReactNode } from 'react';
import type { MessageDescriptor } from 'react-intl';
import { createSlot } from '@ortha-cms/utils-admin';
import type { WysiwygMediaPort } from '@ortha-cms/wysiwyg-admin';
import type { FilterField } from '@ortha-cms/query-builder-admin';
import type {
    ContentTypeDetail,
    EntryRecord,
    MediaRef
} from '../../../domain/types/contentType';
import type { EntryMenuGroup, EntryMode } from '../../../domain/constants';

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
    /**
     * The open tab as a path segment to append when linking to *another* record
     * in this same editor — `'/relations'`, or `''` on the default tab. A slot
     * that navigates the user to a sibling record (the i18n plugin's locale
     * switch) appends it so the reader lands on the tab they were working in
     * instead of being dropped back on General.
     */
    tabSegment: string;
};

/** One entry-sidebar widget contribution (a section of the Properties rail). */
export type EntrySidebarWidgetItem = {
    /** Stable id (used as the React key). */
    id: string;
    /**
     * The widget, rendered below the Revisions block. The rail is **one flat
     * panel** whose blocks are separated by dividers, so a widget should render
     * the exported `EntrySidebarSection` (and `EntrySidebarRow`) rather than a
     * card of its own — otherwise it is the one floating box in the panel.
     */
    Component: ComponentType<EntrySlotContext>;
};

/** Sections appended to the entry editor's Properties rail. */
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

/** One always-mounted overlay contribution for the content library. */
export type ContentOverlayItem = {
    /** Stable id (used as the React key). */
    id: string;
    /**
     * Rendered once at the library's page level, taking no props. Mount only
     * viewport-level chrome here (a portalled cover) — this renders on **every**
     * content route, so anything view-specific belongs in a narrower slot.
     */
    Component: ComponentType;
};

/**
 * Viewport-level overlays for the content library, rendered by
 * `ContentLibraryPage` **outside** its routes — so a contribution stays mounted
 * across every navigation *within* the library, including the window where an
 * entry editor has unmounted itself for its loading state.
 *
 * That window is the whole reason this slot exists. The i18n plugin's
 * locale-switch cover used to be rendered by the editor's sidebar widget, which
 * is inside the very tree that unmounts while the destination record loads: the
 * cover vanished mid-transition, exposing the editor's spinner, then came back
 * when the editor re-rendered — two loaders blinking in sequence. A cover has to
 * outlive the thing it is covering.
 */
export const CONTENT_OVERLAY_SLOT =
    createSlot<ContentOverlayItem>('content.overlay');

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

/**
 * The minimal form bridge an {@link EntryTabItem} needs to render controls bound
 * to the editor's shared form — so a contributed tab (e.g. the Media tab) edits
 * the same `values` the built-in tabs do. A field edited on a slot tab rides
 * Save, the Changed badge, the publish gate, and the server-422 mapping exactly
 * like a General-tab field, because it's the same form state.
 */
export type EntryTabForm = {
    /** The current form values, keyed by field name. */
    values: Record<string, unknown>;
    /** The (localized) validation error for a field, if any. */
    errorFor: (field: string) => string | undefined;
    /** Set a field's value. */
    setValue: (field: string, value: unknown) => void;
    /** Mark a field touched (so its error may show). */
    touch: (field: string) => void;
    /** Whether a field holds an unsaved edit (drives the Changed badge). */
    isFieldDirty: (field: string) => boolean;
};

/** Context handed to a {@link EntryTabItem}'s tab panel — slot context + form. */
export type EntryTabContext = EntrySlotContext & {
    /** Form bridge for rendering controls bound to the editor's values. */
    form: EntryTabForm;
    /**
     * The saved entry's media fields resolved to display refs (name / thumbnail
     * url / kind), keyed by field name — so a tab can label pre-existing assets
     * without re-fetching. Empty while creating, or when no media resolver is
     * bound. Freshly picked/uploaded assets aren't here (the tab tracks those
     * from the picker); a thumbnail always renders from the id regardless.
     */
    mediaRefs: Record<string, MediaRef[]>;
    /**
     * Whether {@link EntryTabContext.mediaRefs} is still loading (or failed).
     * A tab that renders a ref-backed thumbnail needs to tell "not resolved
     * **yet**" from "resolved to nothing": the first is a placeholder, the
     * second is a real absence it should stop waiting on.
     */
    mediaRefsPending: boolean;
    /**
     * The {@link EntryPresave.handle}s of every presave contribution, keyed by
     * item id — opaque, and a tab reads only its own key. It is how a tab reaches
     * state mounted above it (staged uploads survive a tab switch; the tab body
     * does not).
     */
    presave: Record<string, unknown>;
};

/**
 * One entry-editor tab contribution. A contributed tab renders after the
 * built-in General/Relations tabs and before History, ordered by {@link order}.
 * Its {@link slug} MUST be a known editor tab slug (`ENTRY_TAB_SLUGS`) so the
 * route table and the tab-from-path resolver accept it. The tab appears only
 * when {@link appliesTo} returns true for the open type (e.g. the Media tab only
 * when the type has media fields).
 */
export type EntryTabItem = {
    /** Stable id (React key). */
    id: string;
    /** URL tab segment — must be one of `ENTRY_TAB_SLUGS`. */
    slug: string;
    /** Tab trigger label. */
    label: MessageDescriptor;
    /** Sort order among contributed tabs (ascending). */
    order: number;
    /** Whether this tab applies to the open type. */
    appliesTo: (schema: ContentTypeDetail) => boolean;
    /** The tab panel, rendered with the editor's slot + form context. */
    Component: ComponentType<EntryTabContext>;
};

/**
 * Extra tabs in the entry editor (e.g. the media plugin's Media tab). Declared
 * here and rendered by `EntryEditor`; contributors register items via their
 * `AdminPlugin.slots`. Boot-frozen like every slot, so the tab set is stable
 * across renders.
 */
export const ENTRY_TAB_SLOT = createSlot<EntryTabItem>('content.entry.tabs');

/** What an {@link EntryMenuItem} renders as, once its hook has run. */
export type EntryMenuEntry = {
    /** The item's label. */
    label: ReactNode;
    /** Leading icon, as any other menu item carries. */
    icon?: ComponentType;
    /** Render it disabled (e.g. while its own request is in flight). */
    disabled?: boolean;
    /** Style it as destructive — reserve for the `danger` group. */
    destructive?: boolean;
    /** Run the action. Selecting an item always closes the menu. */
    onSelect: () => void;
    /**
     * A dialog or other overlay this item owns. Rendered **outside** the menu,
     * so it survives the menu closing — which is precisely when it needs to
     * appear. Keep it mounted and drive it from your own state.
     */
    overlay?: ReactNode;
};

/** One contributed item in the entry editor's ⋯ menu. */
export type EntryMenuItem = {
    /** Stable id (used as the React key). */
    id: string;
    /** Which section it renders in; sections are separated by a rule. */
    group: EntryMenuGroup;
    /** Sort within the group. */
    order: number;
    /** Limit the item to certain types; omitted = every type. */
    appliesTo?: (schema: ContentTypeDetail) => boolean;
    /**
     * Resolves the item for the open editor — **a hook**, called once per item
     * per render (boot-frozen slots, so the order is stable; see this module's
     * header). It is a hook and not static data because a real item needs
     * queries, `useHasPermission`, and its own dialog state. Return `null` to
     * render nothing — that is how an item hides itself without skipping the
     * hook.
     */
    useItem: (context: EntrySlotContext) => EntryMenuEntry | null;
};

/**
 * Extra actions in the entry editor's **⋯ menu**, beside the built-in Save /
 * Publish / Delete. Grouped by {@link ENTRY_MENU_GROUP} and rendered by
 * `EntryActions`, which also renders each item's `overlay` outside the menu.
 * `@ortha-cms/i18n-admin` fills it with **Publish all locales** / **Unpublish
 * all locales**.
 */
export const ENTRY_MENU_SLOT = createSlot<EntryMenuItem>('content.entry.menu');

/**
 * One plugin's participation in the **save itself** — work that must happen
 * between "the user pressed Save/Publish" and the write, plus the state that
 * work is staged in.
 */
export type EntryPresave = {
    /**
     * Runs inside the save, after client validation and **before** the write,
     * with the values about to be sent; returns the values to actually save.
     * The media plugin uploads the files staged on media fields here and swaps
     * their placeholder ids for the real asset ids — so nothing is uploaded
     * until the record is saved. Throwing **aborts the save**: nothing is
     * written and the editor stays put, so the step owns surfacing its own
     * failure (a toast naming the file).
     */
    commit: (input: {
        values: Record<string, unknown>;
        publish: boolean;
    }) => Promise<Record<string, unknown>>;
    /** Called after the write succeeded, to drop whatever `commit` consumed. */
    settle?: () => void;
    /**
     * Opaque handle published to contributed tabs as
     * `EntryTabContext.presave[id]`. This is how a tab's controls reach staging
     * state that has to **outlive the tab body**: editor tabs are routes, so the
     * panel unmounts the moment the user switches tab, while this hook is
     * mounted by the entry view for the editor's whole life. A slot reads only
     * its own key (same contract as `EntrySlotContext.params`).
     */
    handle?: unknown;
};

/** A contribution to the entry save. See {@link EntryPresave}. */
export type EntryPresaveItem = {
    /** Stable id — also the key its `handle` is published under. */
    id: string;
    /**
     * Hook mounted **once per entry view**, for the editor's whole life. Called
     * unconditionally in slot order, which is rules-of-hooks-safe because slot
     * items are boot-frozen (the same guarantee `RECORDS_COLUMN_SLOT.useRowsData`
     * relies on).
     */
    usePresave: () => EntryPresave;
};

/**
 * Contributions to the entry **save**: an async step run before the write, and
 * the staging state behind it. Mounted by `ContentEntryView` (which owns the
 * busy overlay covering the whole write, uploads included).
 */
export const ENTRY_PRESAVE_SLOT = createSlot<EntryPresaveItem>(
    'content.entry.presave'
);

/** What an {@link AssetPickerItem}'s hook hands back to the control using it. */
export type AssetPicker = {
    /** The port the rich-text editor's image block calls. */
    port: WysiwygMediaPort;
    /**
     * The picker's own UI (a dialog), rendered by the control **beside** the
     * field. It has to be returned rather than mounted by the contributor
     * because the contributor is a hook: a dialog needs somewhere in the tree
     * to render, and the only component that knows where is the one that asked
     * for the picker.
     */
    overlay?: ReactNode;
};

/**
 * One asset-picker contribution — how a field that needs *an image from
 * somewhere* reaches the media library without content-admin depending on it.
 *
 * The rich-text field is what needs it: its image block wants a URL, and the
 * library is another plugin's. Only the first registered item is used; a second
 * would mean two dialogs answering the same question.
 */
export type AssetPickerItem = {
    /** Stable id. */
    id: string;
    /**
     * Hook mounted by the control that offers the picker, once per field. Like
     * every slot hook it is called unconditionally in slot order, which is
     * rules-of-hooks-safe because slot items are boot-frozen (see the module
     * header).
     */
    usePicker: () => AssetPicker;
};

/**
 * The asset picker a rich-text field offers on its image block. Filled by
 * `@ortha-cms/media-admin`; with nothing registered the field simply doesn't
 * show a "choose from library" button, and a pasted URL still works.
 */
export const ASSET_PICKER_SLOT = createSlot<AssetPickerItem>(
    'content.assetPicker'
);
