import { useMemo } from 'react';
import { AuthStatus, useAuth } from '@ortha-cms/identity-admin';
import { byOrder } from '@ortha-cms/utils-admin';
import {
    INSIGHTS_SECTION_SLOT,
    INSIGHTS_WIDGET_SLOT,
    type InsightsSection,
    type InsightsWidget
} from '../../presentation/slots/insightsSlots';

/** One section plus the widgets that are actually visible inside it. */
export type InsightsBand = {
    /** The section's registration. */
    section: InsightsSection;
    /** Its widgets, ordered, already filtered by permission. */
    widgets: InsightsWidget[];
};

/**
 * Resolves the Insights page layout: every registered section, in order, with
 * the widgets the signed-in user is allowed to see.
 *
 * Permissions are read **once** from the auth state rather than by calling
 * `useHasPermission` per widget. Slot registration is frozen at boot so a hook
 * per item would technically be safe, but resolving the set up front is what
 * lets the page decide whether a section has any visible widgets *before*
 * rendering its heading — otherwise a viewer without `content:read` gets a
 * "Content" band sitting over nothing.
 *
 * Bands with no visible widgets are dropped entirely, so a deployment that
 * doesn't register `media-admin` simply has no media band rather than an empty
 * labelled gap.
 */
export function useInsightsLayout(): InsightsBand[] {
    const auth = useAuth();
    const permissions =
        auth.status === AuthStatus.Authenticated ? auth.user.permissions : [];

    // The permission list is a new array each render; keying the memo on its
    // contents rather than its identity keeps the layout stable across renders.
    const permissionKey = permissions.join(',');

    return useMemo(() => {
        const granted = new Set(permissionKey ? permissionKey.split(',') : []);
        const sections = byOrder(INSIGHTS_SECTION_SLOT.getItems());
        const widgets = byOrder(INSIGHTS_WIDGET_SLOT.getItems());

        const visible = widgets.filter(
            (widget) => !widget.permission || granted.has(widget.permission)
        );

        if (process.env.NODE_ENV !== 'production') {
            const known = new Set(sections.map((section) => section.id));
            for (const widget of visible) {
                if (!known.has(widget.section)) {
                    console.warn(
                        `[insights] widget "${widget.id}" targets unknown section "${widget.section}" and will not render.`
                    );
                }
            }
        }

        return sections
            .map((section) => ({
                section,
                widgets: visible.filter(
                    (widget) => widget.section === section.id
                )
            }))
            .filter((band) => band.widgets.length > 0);
    }, [permissionKey]);
}
