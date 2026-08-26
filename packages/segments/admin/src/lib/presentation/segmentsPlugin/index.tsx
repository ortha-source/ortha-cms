import { Suspense, lazy } from 'react';
import type { AdminPlugin } from '@orthacms/bootstrap-admin';
import { SIDEBAR_NAV_SLOT } from '@orthacms/shell-admin';
import {
    ENTRY_HEADER_SLOT,
    ENTRY_PRESAVE_SLOT,
    ENTRY_TAB,
    ENTRY_TAB_SLOT
} from '@orthacms/content-admin';
import { Spinner } from '@orthacms/design-system';
import { ShieldCheck } from 'lucide-react';
import { SEGMENTS_READ } from '../../application/hooks';
import {
    ENTRY_ACCESS_PRESAVE_ID,
    useEntryAccessPresave
} from '../../application/useEntryAccessPresave';
import { EntryAccessChip } from '../components/EntryAccessChip';
import { EntryAccessTab } from '../components/EntryAccessTab';

// Lazy so the directory is code-split into its own chunk. The entry chip and
// tab are **not** lazy: they mount inside the editor, which is already a chunk
// of its own, and a suspense boundary around a badge in the title row is a
// flicker on every entry open.
const SegmentsPage = lazy(() =>
    import('../pages/SegmentsPage').then((module) => ({
        default: module.SegmentsPage
    }))
);

/** Admin-side segments plugin shape — a named alias of {@link AdminPlugin}. */
export type SegmentsAdminPlugin = AdminPlugin;

/**
 * Creates the admin-side segments plugin — two surfaces and no more.
 *
 * The **directory** at `/segments` manages the vocabulary: the audiences
 * readers are divided into. It is a top-level page rather than a workspace one
 * because an audience is installation-wide, like a content type — the same
 * customer whichever workspace's content they are reading.
 *
 * The **entry editor** is where every decision is made: a chip in the title row
 * saying whether the entry is restricted, and the Access tab behind it with one
 * three-state control per audience. There is nothing between the two — no rule
 * library, no assignment screen — because there is nothing in the model
 * between them.
 *
 * @example
 * ```typescript
 * createAdmin({
 *   plugins: [ShellPlugin(), ContentPlugin(), SegmentsPlugin()],
 * });
 * ```
 */
export function SegmentsPlugin(): SegmentsAdminPlugin {
    return {
        name: 'segments',
        routes: [
            {
                path: '/segments',
                element: (
                    <Suspense fallback={<Spinner />}>
                        <SegmentsPage />
                    </Suspense>
                )
            }
        ],
        slots: [
            {
                slot: SIDEBAR_NAV_SLOT,
                items: [
                    {
                        labelId: 'segments.nav.label',
                        defaultLabel: 'Segments',
                        to: '/segments',
                        group: 'directory',
                        order: 40,
                        icon: ShieldCheck,
                        iconColor: 'text-nav-purple',
                        // Without this the row is a dead link for anyone who
                        // cannot read the directory: the page renders its
                        // no-access state, so the nav would promise a
                        // destination it does not deliver.
                        permission: SEGMENTS_READ
                    }
                ]
            },
            {
                slot: ENTRY_HEADER_SLOT,
                items: [
                    { id: 'segments.entry.chip', Component: EntryAccessChip }
                ]
            },
            {
                slot: ENTRY_TAB_SLOT,
                items: [
                    {
                        id: 'segments.entry.tab',
                        slug: ENTRY_TAB.Access,
                        label: {
                            id: 'segments.entryTab.label',
                            defaultMessage: 'Access'
                        },
                        order: 20,
                        // Every type, unlike the Media tab: any entry can be
                        // restricted, and a schema says nothing about whether
                        // it should be. The tab renders its own "no audiences
                        // yet" state when none exists.
                        appliesTo: () => true,
                        Component: EntryAccessTab
                    }
                ]
            },
            {
                // Access rides the entry's own Save / Publish rather than a
                // button of its own — and it has to be staged here, above the
                // editor, because the tab that stages it is a route and unmounts
                // on every tab switch.
                slot: ENTRY_PRESAVE_SLOT,
                items: [
                    {
                        id: ENTRY_ACCESS_PRESAVE_ID,
                        usePresave: useEntryAccessPresave
                    }
                ]
            }
        ]
    };
}
