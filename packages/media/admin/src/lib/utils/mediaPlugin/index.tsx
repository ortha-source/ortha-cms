import { Suspense, lazy } from 'react';
import type { AdminPlugin } from '@ortha-cms/bootstrap-admin';
import {
    WORKSPACE_ROUTE_SLOT,
    WORKSPACE_NAV_SLOT
} from '@ortha-cms/workspaces-admin';
import {
    ASSET_PICKER_SLOT,
    CONTENT_FIELD_TYPE,
    ENTRY_PRESAVE_SLOT,
    ENTRY_TAB,
    ENTRY_TAB_SLOT,
    type ContentTypeDetail
} from '@ortha-cms/content-admin';
import { Image } from 'lucide-react';
import { EntryMediaTab } from '../../components/EntryMediaTab';
import {
    MEDIA_PRESAVE_ID,
    usePendingMediaUploads
} from '../../hooks/usePendingMediaUploads';
import {
    WYSIWYG_ASSET_PICKER_ID,
    useWysiwygAssetPicker
} from '../../hooks/useWysiwygAssetPicker';

const MediaLibraryPage = lazy(() =>
    import('../../pages/MediaLibraryPage').then((module) => ({
        default: module.MediaLibraryPage
    }))
);

/** The Media tab applies to any type that declares a media field. */
function hasMediaField(schema: ContentTypeDetail): boolean {
    return schema.fields.some(
        (field) => field.type === CONTENT_FIELD_TYPE.Media
    );
}

/**
 * Admin-side media plugin shape. A thin alias of {@link AdminPlugin}, kept named
 * so future config has a home.
 */
export type MediaAdminPlugin = AdminPlugin;

/**
 * Creates the admin-side Media Library plugin. It lives **strictly inside a
 * workspace**: it contributes no top-level route and no top-toolbar nav entry,
 * only a rail button (`order: 20`) + a route to the workspace shell's slots
 * (owned by `@ortha-cms/workspaces-admin`). Register it after
 * `WorkspacesPlugin()` so those slots exist.
 */
export function MediaPlugin(): MediaAdminPlugin {
    return {
        name: 'media',
        slots: [
            {
                slot: WORKSPACE_NAV_SLOT,
                items: [
                    {
                        labelId: 'media.nav.label',
                        defaultLabel: 'Media Library',
                        to: 'media',
                        order: 20,
                        icon: Image,
                        iconColor: 'text-nav-teal'
                    }
                ]
            },
            {
                slot: WORKSPACE_ROUTE_SLOT,
                items: [
                    {
                        path: 'media/*',
                        element: (
                            <Suspense fallback={null}>
                                <MediaLibraryPage />
                            </Suspense>
                        )
                    }
                ]
            },
            // The entry editor's Media tab — rendered by content-admin's
            // ENTRY_TAB_SLOT only when the open type has a media field, so the
            // tab appears exactly where media applies. Its `slug` is content's
            // own `media` tab route, already accepted by the tab router.
            {
                slot: ENTRY_TAB_SLOT,
                items: [
                    {
                        id: 'media.entry.tab',
                        slug: ENTRY_TAB.Media,
                        label: {
                            id: 'media.tab.label',
                            defaultMessage: 'Media'
                        },
                        order: 10,
                        appliesTo: hasMediaField,
                        Component: EntryMediaTab
                    }
                ]
            },
            // Files chosen on a media field are staged, not uploaded: this step
            // runs inside the record's save and puts them in the library then,
            // so an abandoned edit leaves no orphan assets behind. It also owns
            // the staging state, mounted above the tab body (a route) so it
            // survives switching tabs.
            {
                slot: ENTRY_PRESAVE_SLOT,
                items: [
                    {
                        id: MEDIA_PRESAVE_ID,
                        usePresave: usePendingMediaUploads
                    }
                ]
            },
            // The library, offered to a rich-text field's image block. Unlike a
            // media *field*, an image in a document is a URL in the stored
            // HTML — so this only browses what is already in the library and
            // never uploads: an upload from inside a draft would be a file in
            // the library whether or not the record is ever saved, which is
            // exactly what the staged-upload presave above exists to avoid.
            {
                slot: ASSET_PICKER_SLOT,
                items: [
                    {
                        id: WYSIWYG_ASSET_PICKER_ID,
                        usePicker: useWysiwygAssetPicker
                    }
                ]
            }
        ]
    };
}
