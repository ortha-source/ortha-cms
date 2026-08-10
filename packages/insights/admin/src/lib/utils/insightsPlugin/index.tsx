import { Suspense, lazy } from 'react';
import type { AdminPlugin } from '@ortha-cms/bootstrap-admin';
import {
    WORKSPACE_ROUTE_SLOT,
    WORKSPACE_NAV_SLOT
} from '@ortha-cms/workspaces-admin';
import { BarChart3 } from 'lucide-react';
import {
    INSIGHTS_SECTION_IDS,
    INSIGHTS_SECTION_SLOT
} from '../../presentation/slots/insightsSlots';

const InsightsPage = lazy(() =>
    import('../../presentation/pages/InsightsPage').then((module) => ({
        default: module.InsightsPage
    }))
);

/**
 * Admin-side insights plugin shape. A thin alias of {@link AdminPlugin}, kept
 * named so future config has a home.
 */
export type InsightsAdminPlugin = AdminPlugin;

/**
 * Creates the admin-side Insights plugin.
 *
 * It lives **strictly inside a workspace**: no top-level route, no global nav
 * entry — just a rail button (`order: 30`) and an `insights/*` route on the
 * workspace shell's slots (owned by `@ortha-cms/workspaces-admin`).
 *
 * The four sections it registers are the page's furniture, not its content. The
 * plugin contributes **no widgets** — every card on the page arrives through
 * `INSIGHTS_WIDGET_SLOT` from whichever package owns that data. A section with
 * no widgets renders nothing, so an install without `media-admin` simply has no
 * "Localisation & media" band.
 *
 * Registration order against other plugins does not matter: `createAdmin` walks
 * every plugin's contributions in one pass *after* all factories have run, so a
 * package contributing widgets here is free to be registered before it.
 */
export function InsightsPlugin(): InsightsAdminPlugin {
    return {
        name: 'insights',
        slots: [
            {
                slot: WORKSPACE_NAV_SLOT,
                items: [
                    {
                        labelId: 'insights.nav.label',
                        defaultLabel: 'Insights',
                        to: 'insights',
                        order: 30,
                        icon: BarChart3,
                        iconColor: 'text-nav-amber'
                    }
                ]
            },
            {
                slot: WORKSPACE_ROUTE_SLOT,
                items: [
                    {
                        path: 'insights/*',
                        element: (
                            <Suspense fallback={null}>
                                <InsightsPage />
                            </Suspense>
                        )
                    }
                ]
            },
            {
                slot: INSIGHTS_SECTION_SLOT,
                items: [
                    {
                        id: INSIGHTS_SECTION_IDS.Overview,
                        order: 10,
                        titleId: 'insights.section.overview',
                        defaultTitle: 'Overview'
                    },
                    {
                        id: INSIGHTS_SECTION_IDS.Content,
                        order: 20,
                        titleId: 'insights.section.content',
                        defaultTitle: 'Content'
                    },
                    {
                        id: INSIGHTS_SECTION_IDS.Reach,
                        order: 30,
                        titleId: 'insights.section.reach',
                        defaultTitle: 'Localisation & media'
                    },
                    {
                        id: INSIGHTS_SECTION_IDS.Team,
                        order: 40,
                        titleId: 'insights.section.team',
                        defaultTitle: 'Team'
                    }
                ]
            }
        ]
    };
}
