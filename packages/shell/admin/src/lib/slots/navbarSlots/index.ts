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
};

/**
 * Start (leading) toolbar slot — the primary nav, rendered after the brand.
 * Any plugin contributes entries via its `slots`; {@link AppShell} reads it
 * sorted by `order`. Named for placement so the trailing side can get its own
 * slot: a `NAVBAR_END_SLOT` (`'shell.navbar.end'`) for account/actions will be
 * added here when first needed.
 */
export const NAVBAR_START_SLOT = createSlot<NavbarItem>('shell.navbar.start');
