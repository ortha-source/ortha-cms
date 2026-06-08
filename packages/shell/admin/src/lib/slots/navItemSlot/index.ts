import type { ComponentType } from 'react';
import { createSlot } from '@ortha-cms/utils-admin';

/** A navigation entry rendered in the top toolbar. */
export type NavItem = {
    /** react-intl message id for the label. */
    labelId: string;
    /** Fallback label when no translation is available. */
    defaultLabel: string;
    /** Route path this entry links to. */
    to: string;
    /** When true, only the exact path is active (no sub-path matching). */
    end?: boolean;
    /** Sort order; lower appears first. */
    order: number;
    /** Optional leading icon (e.g. a lucide-react icon). */
    icon?: ComponentType<{ className?: string }>;
};

/**
 * The top-toolbar nav-item slot. The shell's {@link AppShell} reads it; any
 * plugin may contribute entries via its `slots`. Defined here (not the host)
 * because the toolbar is a shell concern.
 */
export const NAV_ITEM_SLOT = createSlot<NavItem>('shell.navItem');
