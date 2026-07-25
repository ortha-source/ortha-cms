import { ENTRY_STATUS } from '../constants';
import type { EntryRecord } from '../types/contentType';

/**
 * The publish state as the UI tells it — the stored `status` split by whether
 * the record has live content behind it.
 */
export const ENTRY_STATUS_VIEW = {
    /** A create form: nothing stored yet. */
    New: 'new',
    /** Stored, never published (or explicitly unpublished). */
    Draft: 'draft',
    /** Published, with unpublished edits saved on top. */
    Modified: 'modified',
    /** Live: the stored record is what's published. */
    Published: 'published'
} as const;

/** @see ENTRY_STATUS_VIEW */
export type EntryStatusView =
    (typeof ENTRY_STATUS_VIEW)[keyof typeof ENTRY_STATUS_VIEW];

/**
 * The design-system `Badge` variant per state, shared so every surface tints a
 * record's publish state the same way — the editor's Details card, the records
 * table's Status column, and the i18n plugin's locale rows/badges.
 *
 * Modified is `warning`, not `success`: what is live is *not* what's on screen,
 * so it must not read as a clean published record.
 */
export const ENTRY_STATUS_VIEW_VARIANT: Record<
    EntryStatusView,
    'outline' | 'secondary' | 'warning' | 'success'
> = {
    [ENTRY_STATUS_VIEW.New]: 'outline',
    [ENTRY_STATUS_VIEW.Draft]: 'secondary',
    [ENTRY_STATUS_VIEW.Modified]: 'warning',
    [ENTRY_STATUS_VIEW.Published]: 'success'
};

/**
 * Classify a record's publish state for display.
 *
 * The server has only two stored states — a save moves a publishable entry back
 * to `draft` while its published *version* stays live in history — so "draft"
 * alone conflates two situations a writer needs to tell apart: a record nobody
 * has ever published, and a **published** record carrying edits that aren't live
 * yet. `publishedAt` is what separates them: it is stamped on publish, cleared
 * only by unpublish, and deliberately survives an edit.
 *
 * Pure and shared, so the records table and the editor's Details card can't
 * disagree about what a row's badge says.
 */
export function entryStatusView(entry?: {
    status?: EntryRecord['status'];
    publishedAt?: EntryRecord['publishedAt'];
}): EntryStatusView {
    if (!entry) return ENTRY_STATUS_VIEW.New;
    if (entry.status === ENTRY_STATUS.Published)
        return ENTRY_STATUS_VIEW.Published;
    return entry.publishedAt
        ? ENTRY_STATUS_VIEW.Modified
        : ENTRY_STATUS_VIEW.Draft;
}
