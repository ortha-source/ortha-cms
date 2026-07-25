import { defineMessages } from 'react-intl';
import type { AdminPlugin } from '@ortha-cms/bootstrap-admin';
import {
    CONTENT_OVERLAY_SLOT,
    ENTRY_HEADER_SLOT,
    ENTRY_PARAMS_SLOT,
    ENTRY_SIDEBAR_WIDGET_SLOT,
    RECORDS_COLUMN_SLOT,
    RECORDS_FILTER_FIELDS_SLOT,
    RECORDS_TOOLBAR_SLOT,
    type ContentTypeDetail,
    type EntryRecord,
    type EntrySlotContext,
    type ContentOverlayItem,
    type EntryHeaderItem,
    type RecordsColumnItem,
    type RecordsToolbarItem,
    type EntrySidebarWidgetItem,
    type RecordsFilterFieldsItem,
    type EntryParamsItem
} from '@ortha-cms/content-admin';
import {
    LOCALE_GROUP_PARAM,
    LOCALE_PARAM,
    SLOT_ITEM_ID
} from '../../constants';
import { useLocaleSummaries } from '../../api/useLocaleSummaries';
import { useLocaleFilterFields } from '../../hooks/useLocaleFilterFields';
import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { LocalesColumnCell } from '../../components/LocalesColumnCell';
import { LocaleWidget } from '../../components/LocaleWidget';
import { LocaleTitleChip } from '../../components/LocaleTitleChip';
import { LocaleSwitchOverlay } from '../../components/LocaleSwitchOverlay';

const messages = defineMessages({
    localesColumn: {
        id: 'i18n.column.header',
        defaultMessage: 'Locales'
    }
});

/** The plugin object shape returned by {@link I18nPlugin}. */
export type I18nAdminPlugin = AdminPlugin;

/**
 * Creates the i18n admin plugin — content localization for the Content
 * Library. Contributes **only** to `@ortha-cms/content-admin`'s extension
 * slots (no routes, no layout, no nav):
 *
 * - a searchable **locale switcher** in the records toolbar (owns the
 *   `?locale=` list param; the server scopes the list to it, defaulting to
 *   the default locale);
 * - an optional **Locales** table column — per-row badges of the translation
 *   group's locales with publish status, batch-loaded per page;
 * - the **locale panel** in the entry editor's sidebar (per-locale status,
 *   open a sibling, create a translation);
 * - a **current-locale chip** beside the entry-editor title;
 * - **Has locale / Missing locale / Locale count** filter fields;
 * - entry param plumbing: the single-page read and the create body carry the
 *   active locale, and relation-picker candidates are scoped to the source
 *   entry's locale with default-locale fallback.
 *
 * Register it **after** `ContentPlugin()` in `createAdmin({ plugins })` — it
 * contributes only to slots the content plugin owns.
 */
export function I18nPlugin(): I18nAdminPlugin {
    // Each item is typed explicitly so the callback parameters infer — the
    // AdminPlugin `slots` array is heterogeneous (`SlotContribution<unknown>`),
    // so a bare object literal wouldn't be contextually typed by its slot.
    const switcherItem: RecordsToolbarItem = {
        id: SLOT_ITEM_ID.Switcher,
        listParamKeys: [LOCALE_PARAM],
        Component: LocaleSwitcher
    };
    const columnItem: RecordsColumnItem = {
        id: SLOT_ITEM_ID.Column,
        label: messages.localesColumn,
        appliesTo: (schema: ContentTypeDetail) => !!schema.i18n,
        // Called from the records view's per-render item loop — safe because
        // slot items are boot-frozen; gates its own fetching on the schema
        // being i18n.
        useRowsData: (entries: EntryRecord[], schema: ContentTypeDetail) =>
            useLocaleSummaries(
                schema.name,
                entries.map((entry) => entry.localeGroupId),
                !!schema.i18n
            ),
        Cell: LocalesColumnCell
    };
    const widgetItem: EntrySidebarWidgetItem = {
        id: SLOT_ITEM_ID.Widget,
        Component: LocaleWidget
    };
    const titleChipItem: EntryHeaderItem = {
        id: SLOT_ITEM_ID.TitleChip,
        Component: LocaleTitleChip
    };
    // Page-level, not inside the editor: the cover has to stay mounted while
    // the destination record loads — which is exactly when the editor (and any
    // widget inside it) is unmounted for its loading state.
    const switchOverlayItem: ContentOverlayItem = {
        id: SLOT_ITEM_ID.SwitchOverlay,
        Component: LocaleSwitchOverlay
    };
    const filterFieldsItem: RecordsFilterFieldsItem = {
        id: SLOT_ITEM_ID.FilterFields,
        useFields: useLocaleFilterFields
    };
    const entryParamsItem: EntryParamsItem = {
        id: SLOT_ITEM_ID.EntryParams,
        // A single page resolves its row by the active locale.
        listParamKeys: [LOCALE_PARAM],
        // A create stamps the locale it was opened under, and (when creating a
        // translation via the locale widget) joins the row to that group.
        createBodyKeys: [LOCALE_PARAM, LOCALE_GROUP_PARAM],
        // Relation candidates are scoped **strictly** to the active locale —
        // cross-locale linking isn't allowed, so no default fallback. The locale
        // is the saved entry's (edit mode) or the create form's `?locale=` (a
        // translation draft has no `entry` yet). A fresh default-locale create
        // resolves nothing → `{}` → the server scopes to the default locale.
        relationCandidateParams: (
            targetSchema: ContentTypeDetail,
            source: EntrySlotContext
        ): Record<string, string> => {
            const locale =
                source.entry?.locale ?? source.params?.[LOCALE_PARAM];
            return targetSchema.i18n && locale
                ? { [LOCALE_PARAM]: locale }
                : {};
        }
    };
    return {
        name: 'i18n',
        slots: [
            { slot: RECORDS_TOOLBAR_SLOT, items: [switcherItem] },
            { slot: RECORDS_COLUMN_SLOT, items: [columnItem] },
            { slot: ENTRY_SIDEBAR_WIDGET_SLOT, items: [widgetItem] },
            { slot: ENTRY_HEADER_SLOT, items: [titleChipItem] },
            { slot: CONTENT_OVERLAY_SLOT, items: [switchOverlayItem] },
            { slot: RECORDS_FILTER_FIELDS_SLOT, items: [filterFieldsItem] },
            { slot: ENTRY_PARAMS_SLOT, items: [entryParamsItem] }
        ]
    };
}
