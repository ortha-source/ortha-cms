import type { ComponentType } from 'react';
import { createSlot } from '@orthacms/utils-admin';

/**
 * One section of the reader's **notification settings** (`/inbox/settings`)
 * — how a plugin that tells people things lets them choose how often, without
 * the inbox learning what the setting is about. Alarms contributes the
 * digest's frequency.
 *
 * The section draws its own `<h2>` and controls and reads its own data; the
 * page orders the sections and says so when there are none.
 */
export type InboxSettingsSection = {
    /** Stable id (also the React key). */
    id: string;
    /** Sort order; lower appears first. */
    order: number;
    Component: ComponentType;
};

/** The notification-settings page's sections. Empty by default. */
export const INBOX_SETTINGS_SLOT = createSlot<InboxSettingsSection>(
    'inbox.settings.section'
);
