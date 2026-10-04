import { Suspense, lazy } from 'react';
import { Blocks } from 'lucide-react';
import type { AdminPlugin } from '@orthacms/bootstrap-admin';
import { SIDEBAR_NAV_SLOT } from '@orthacms/shell-admin';
import { ContentModelPageSkeleton } from '../../presentation/components/ContentModelPageSkeleton';

// Lazy so the page is its own chunk, fetched on first navigation.
const ContentModelPage = lazy(() =>
    import('../../presentation/pages/ContentModelPage').then((module) => ({
        default: module.ContentModelPage
    }))
);

/** Admin-side schema builder plugin shape — a named alias of {@link AdminPlugin}. */
export type SchemaBuilderAdminPlugin = AdminPlugin;

/**
 * Creates the admin-side schema builder (ADR-0020): the `/content-model`
 * page, one type per URL (`/content-model/:typeName`), and its entry in the
 * global sidebar's `directory` group. Global rather than per-workspace,
 * because content types are code and the same everywhere; gated on
 * `content:read`, the permission the document route needs.
 */
export function SchemaBuilderPlugin(): SchemaBuilderAdminPlugin {
    return {
        name: 'schema-builder',
        routes: [
            {
                path: '/content-model/:typeName?',
                element: (
                    <Suspense fallback={<ContentModelPageSkeleton />}>
                        <ContentModelPage />
                    </Suspense>
                )
            }
        ],
        slots: [
            {
                slot: SIDEBAR_NAV_SLOT,
                items: [
                    {
                        labelId: 'schemaBuilder.nav.label',
                        defaultLabel: 'Content model',
                        to: '/content-model',
                        group: 'directory',
                        // After Webhooks (40): the last of the developer-facing
                        // destinations.
                        order: 50,
                        icon: Blocks,
                        iconColor: 'text-nav-blue',
                        permission: 'content:read'
                    }
                ]
            }
        ]
    };
}
