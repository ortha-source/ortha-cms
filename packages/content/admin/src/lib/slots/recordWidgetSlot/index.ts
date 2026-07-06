import type { ReactNode } from 'react';
import { createSlot } from '@ortha-cms/utils-admin';
import type { RecordDraft } from '../../types/recordDraft';
import type { RecordEditor } from '../../hooks/useRecordEditor';

/**
 * Read-only context handed to every rail widget: the immutable draft plus the
 * live editor state. Enough for a plugin widget to reflect the record (status,
 * values, gate) without owning any of the editor's write paths.
 */
export interface RecordWidgetContext {
    draft: RecordDraft;
    editor: RecordEditor;
    /** Jump to + focus a field by key (shared with the outline + gate). */
    onJump: (key: string) => void;
}

/** A widget a plugin contributes to the record editor's right rail. */
export interface RecordWidget {
    /** Stable id (also the React key). */
    id: string;
    /** Sort order among contributed widgets; lower renders first. */
    order?: number;
    render: (context: RecordWidgetContext) => ReactNode;
}

/**
 * The record editor's right-rail extension point. The editor renders its three
 * built-in widgets (Publish gate, Details, Locale) first, then every contributed
 * widget in `order`. Plugins contribute via a `slots` entry on their
 * {@link AdminPlugin}, exactly like the workspace rail.
 */
export const RECORD_WIDGET_SLOT = createSlot<RecordWidget>(
    'content.record.widgets'
);
