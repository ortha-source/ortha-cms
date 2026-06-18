import type { ComponentType } from 'react';
import { createSlot } from '@ortha-cms/utils-admin';

/** A navigation entry rendered in the top toolbar (either side). */
export type NavbarItem = {
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
    /**
     * Optional permission key required to see this entry. When set, the entry
     * is hidden from users whose role doesn't grant it (the UI mirror of the
     * linked route's server-side gate). Omit for an entry visible to every
     * signed-in user (the default — the linked page still gates itself).
     */
    permission?: string;
};

/**
 * Start (leading) toolbar slot — the primary nav, rendered after the brand.
 * Any plugin contributes entries via its `slots`; {@link AppShell} reads it
 * sorted by `order`.
 */
export const NAVBAR_START_SLOT = createSlot<NavbarItem>('shell.navbar.start');

/**
 * A trailing toolbar widget (e.g. the account menu). Unlike {@link NavbarItem}
 * — a declarative link — an end item is an arbitrary component the contributing
 * plugin renders itself, so it can own its dropdown, current-user data, and
 * actions. Keep these few; the end region is for account/global actions, not
 * navigation.
 */
export type NavbarEndItem = {
    /** Stable id (also the React key). */
    id: string;
    /** Sort order; lower appears first (leftmost within the end region). */
    order: number;
    /** The widget to render. Receives no props — it reads what it needs (e.g. `useAuth`). */
    Component: ComponentType;
};

/**
 * End (trailing) toolbar slot — account menu and global actions, rendered on
 * the far right after the spacer. A plugin contributes a {@link NavbarEndItem}
 * via its `slots`; {@link AppShell} renders them sorted by `order`.
 */
export const NAVBAR_END_SLOT = createSlot<NavbarEndItem>('shell.navbar.end');
