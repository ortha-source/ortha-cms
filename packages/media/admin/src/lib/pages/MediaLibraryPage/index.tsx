import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Button,
    ConfirmDialog,
    Drawer,
    DrawerContent,
    DrawerTitle,
    toast
} from '@ortha-cms/design-system';
import { PanelLeft } from 'lucide-react';
import { useHasPermission } from '@ortha-cms/identity-admin';
import {
    MEDIA_CREATE,
    MEDIA_DELETE,
    MEDIA_READ,
    MEDIA_UPDATE,
    ROOT_FOLDER_ID
} from '../../constants';
import { useMediaLibrary } from '../../hooks/useMediaLibrary';
import type { MediaAsset } from '../../types/mediaAsset';
import type { MediaFolder } from '../../types/mediaFolder';
import type { AssetActionKind } from '../../components/AssetActionsMenu';
import { MediaFoldersNav } from '../../components/MediaFoldersNav';
import { MediaTopBar } from '../../components/MediaTopBar';
import { MediaToolbar } from '../../components/MediaToolbar';
import { MediaSelectionBar } from '../../components/MediaSelectionBar';
import { MediaUploadBanner } from '../../components/MediaUploadBanner';
import { MediaGrid } from '../../components/MediaGrid';
import { MediaEmptyState } from '../../components/MediaEmptyState';
import { AssetDetailDrawer } from '../../components/AssetDetailDrawer';
import { NewFolderDialog } from '../../components/NewFolderDialog';
import { RenameDialog } from '../../components/RenameDialog';
import { MoveAssetsDialog } from '../../components/MoveAssetsDialog';
import { UploadDialog } from '../../components/UploadDialog';

/** Intl descriptors for the Media Library page + its toasts, co-located. */
const messages = defineMessages({
    title: { id: 'media.page.title', defaultMessage: 'Media Library' },
    subtitle: {
        id: 'media.page.subtitle',
        defaultMessage:
            '{count, plural, one {# item} other {# items}} in {location}'
    },
    allMedia: { id: 'media.page.allMedia', defaultMessage: 'All media' },
    noAccess: {
        id: 'media.page.noAccess',
        defaultMessage: 'You don’t have permission to view the media library.'
    },
    openNav: { id: 'media.page.openNav', defaultMessage: 'Folders' },
    navTitle: {
        id: 'media.page.navTitle',
        defaultMessage: 'Folder navigation'
    },
    selection: {
        id: 'media.page.selection',
        defaultMessage:
            '{count, plural, =0 {No items selected} one {# item selected} other {# items selected}}'
    },
    deleteAssetsTitle: {
        id: 'media.page.deleteAssetsTitle',
        defaultMessage: 'Delete {count, plural, one {# item} other {# items}}?'
    },
    deleteAssetsBody: {
        id: 'media.page.deleteAssetsBody',
        defaultMessage:
            'This can’t be undone. The selected assets will be permanently removed.'
    },
    deleteFolderTitle: {
        id: 'media.page.deleteFolderTitle',
        defaultMessage: 'Delete “{name}”?'
    },
    deleteFolderBody: {
        id: 'media.page.deleteFolderBody',
        defaultMessage:
            'The folder will be permanently removed. It must be empty first — move or delete its contents.'
    },
    confirmDelete: { id: 'media.page.confirmDelete', defaultMessage: 'Delete' },
    // toasts
    tCreated: {
        id: 'media.page.toast.created',
        defaultMessage: 'Folder “{name}” created'
    },
    tRenamed: {
        id: 'media.page.toast.renamed',
        defaultMessage: 'Renamed to “{name}”'
    },
    tDuplicated: {
        id: 'media.page.toast.duplicated',
        defaultMessage:
            '{count, plural, one {# asset duplicated} other {# assets duplicated}}'
    },
    tMoved: {
        id: 'media.page.toast.moved',
        defaultMessage:
            '{count, plural, one {# asset moved} other {# assets moved}}'
    },
    tDeletedAssets: {
        id: 'media.page.toast.deletedAssets',
        defaultMessage:
            '{count, plural, one {# asset deleted} other {# assets deleted}}'
    },
    tDeletedFolder: {
        id: 'media.page.toast.deletedFolder',
        defaultMessage: 'Folder “{name}” deleted'
    },
    tDownload: {
        id: 'media.page.toast.download',
        defaultMessage: 'Downloading “{name}”'
    },
    tCopied: {
        id: 'media.page.toast.copied',
        defaultMessage: 'Link copied to clipboard'
    }
});

/** A pending rename, tagged by whether it targets an asset or a folder. */
type RenameTarget =
    | { kind: 'asset'; id: string; name: string }
    | { kind: 'folder'; id: string; name: string };

/** A pending delete awaiting confirmation. */
type DeleteTarget =
    | { kind: 'assets'; ids: string[] }
    | { kind: 'folder'; folder: MediaFolder };

/**
 * The Media Library, mounted inside the workspace shell at
 * `/workspaces/:id/media`. `useMediaLibrary` is the store — folders and the open
 * folder's assets come from `@ortha-cms/media-server`, and every action (browse
 * folders, upload, create folder, rename, duplicate, move, delete, filter, sort,
 * open the detail drawer) runs against the API, firing a toast per action —
 * except uploads, whose status lives in the `MediaUploadBanner`. Controls gate
 * on the real `media:*` matrix via `useHasPermission`.
 *
 * A sticky `MediaTopBar` heads the page (the shared icon-tile + breadcrumb
 * header every admin page carries), spanning both panes. Below it sits a
 * two-pane layout — a folders sidebar beside the asset browser — plus the detail
 * drawer and the create/rename/move/upload dialogs. Both panes sit
 * **flush on the canvas** (no muted board, no bordered island), mirroring the
 * Content Library's work area: the sidebar is divided by a hairline `border-r`
 * and each pane scrolls independently. Sized with `flex-1` against the workspace
 * shell's `min-h-svh` column — NOT its own `svh` calc — so there is exactly one
 * viewport measurement in the chain; a second, independently rounded one can end
 * up a pixel taller (visible at browser zoom ≠ 100%) and give the document a
 * phantom scrollbar beside the pane's own.
 */
export function MediaLibraryPage() {
    const intl = useIntl();
    // Mirror the server's RBAC: reads gate the queries, writes gate controls.
    const canRead = useHasPermission(MEDIA_READ);
    const canCreate = useHasPermission(MEDIA_CREATE);
    const canUpdate = useHasPermission(MEDIA_UPDATE);
    const canDelete = useHasPermission(MEDIA_DELETE);
    const store = useMediaLibrary(canRead);

    const [navOpen, setNavOpen] = useState(false);
    const [newFolderOpen, setNewFolderOpen] = useState(false);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
    const [moveIds, setMoveIds] = useState<string[] | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

    const locationLabel = store.currentFolder
        ? store.currentFolder.name
        : intl.formatMessage(messages.allMedia);

    const hasFilters = store.search.trim() !== '' || store.kindFilter !== 'all';
    const isEmpty =
        store.childFolders.length === 0 && store.visibleAssets.length === 0;

    // A single dispatcher every card / row / drawer forwards asset actions to.
    const handleAssetAction = (kind: AssetActionKind, asset: MediaAsset) => {
        switch (kind) {
            case 'open':
                store.openDetail(asset.id);
                break;
            case 'download': {
                const link = document.createElement('a');
                link.href = asset.url;
                link.download = asset.name;
                document.body.appendChild(link);
                link.click();
                link.remove();
                toast.success(
                    intl.formatMessage(messages.tDownload, { name: asset.name })
                );
                break;
            }
            case 'copyLink':
                void navigator.clipboard
                    ?.writeText(new URL(asset.url, window.location.origin).href)
                    .catch(() => undefined);
                toast.success(intl.formatMessage(messages.tCopied));
                break;
            case 'duplicate': {
                store.duplicateAssets([asset.id]);
                toast.success(
                    intl.formatMessage(messages.tDuplicated, { count: 1 })
                );
                break;
            }
            case 'rename':
                setRenameTarget({
                    kind: 'asset',
                    id: asset.id,
                    name: asset.name
                });
                break;
            case 'move':
                setMoveIds([asset.id]);
                break;
            case 'delete':
                setDeleteTarget({ kind: 'assets', ids: [asset.id] });
                break;
        }
    };

    const handleRenameFolder = (folder: MediaFolder) =>
        setRenameTarget({ kind: 'folder', id: folder.id, name: folder.name });

    const handleDeleteFolder = (folder: MediaFolder) =>
        setDeleteTarget({ kind: 'folder', folder });

    const submitRename = (name: string) => {
        if (!renameTarget) return;
        if (renameTarget.kind === 'asset') {
            store.renameAsset(renameTarget.id, name);
        } else {
            store.renameFolder(renameTarget.id, name);
        }
        toast.success(intl.formatMessage(messages.tRenamed, { name }));
    };

    const submitMove = (folderId: string) => {
        if (!moveIds) return;
        store.moveAssets(moveIds, folderId);
        toast.success(
            intl.formatMessage(messages.tMoved, { count: moveIds.length })
        );
        store.clearSelection();
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        if (deleteTarget.kind === 'assets') {
            store.deleteAssets(deleteTarget.ids);
            toast.success(
                intl.formatMessage(messages.tDeletedAssets, {
                    count: deleteTarget.ids.length
                })
            );
        } else {
            store.deleteFolder(deleteTarget.folder.id);
            toast.success(
                intl.formatMessage(messages.tDeletedFolder, {
                    name: deleteTarget.folder.name
                })
            );
        }
        setDeleteTarget(null);
    };

    const selectedIds = store.selectedAssets.map((asset) => asset.id);

    if (!canRead) {
        return (
            <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center">
                <p className="max-w-sm text-sm text-muted-foreground">
                    {intl.formatMessage(messages.noAccess)}
                </p>
            </div>
        );
    }

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <MediaTopBar
                breadcrumbs={store.breadcrumbs}
                onNavigate={store.navigateTo}
            />

            <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
                <div className="border-b p-3 lg:hidden">
                    <Button
                        variant="outline"
                        size="sm"
                        className="shadow-none"
                        onClick={() => setNavOpen(true)}
                    >
                        <PanelLeft aria-hidden />
                        {intl.formatMessage(messages.openNav)}
                    </Button>
                </div>

                <MediaFoldersNav
                    className="hidden lg:flex lg:border-r"
                    folders={store.folders}
                    currentFolderId={store.currentFolderId}
                    counts={store.folderCounts}
                    rootCount={store.folderCounts.get(ROOT_FOLDER_ID) ?? 0}
                    onNavigate={store.navigateTo}
                    onNewFolder={() => setNewFolderOpen(true)}
                    canCreate={canCreate}
                />

                <main className="min-w-0 flex-1 overflow-auto">
                    <div className="p-4 sm:p-6">
                        <div className="mb-4">
                            <h1 className="text-2xl font-semibold tracking-[-0.01em]">
                                {store.currentFolder
                                    ? store.currentFolder.name
                                    : intl.formatMessage(messages.title)}
                            </h1>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                                {intl.formatMessage(messages.subtitle, {
                                    count: store.visibleAssets.length,
                                    location: locationLabel
                                })}
                            </p>
                        </div>

                        <MediaToolbar
                            search={store.search}
                            onSearchChange={store.setSearch}
                            kindFilter={store.kindFilter}
                            onKindFilterChange={store.setKindFilter}
                            sort={store.sort}
                            onSortChange={store.setSort}
                            onNewFolder={() => setNewFolderOpen(true)}
                            onUpload={() => setUploadOpen(true)}
                            canCreate={canCreate}
                        />

                        <p className="sr-only" aria-live="polite">
                            {intl.formatMessage(messages.selection, {
                                count: selectedIds.length
                            })}
                        </p>

                        <MediaUploadBanner
                            items={store.uploadItems}
                            summary={store.uploadSummary}
                            onRetry={store.retryUpload}
                            onCancel={store.cancelUpload}
                            onDismiss={store.dismissUploads}
                        />

                        {selectedIds.length > 0 ? (
                            <MediaSelectionBar
                                count={selectedIds.length}
                                onDownload={() =>
                                    toast.success(
                                        intl.formatMessage(messages.tDownload, {
                                            name: `${selectedIds.length} files`
                                        })
                                    )
                                }
                                onDuplicate={() => {
                                    store.duplicateAssets(selectedIds);
                                    toast.success(
                                        intl.formatMessage(
                                            messages.tDuplicated,
                                            {
                                                count: selectedIds.length
                                            }
                                        )
                                    );
                                }}
                                onMove={() => setMoveIds(selectedIds)}
                                onDelete={() =>
                                    setDeleteTarget({
                                        kind: 'assets',
                                        ids: selectedIds
                                    })
                                }
                                onClear={store.clearSelection}
                                canCreate={canCreate}
                                canUpdate={canUpdate}
                                canDelete={canDelete}
                            />
                        ) : null}

                        {isEmpty ? (
                            <MediaEmptyState
                                hasFilters={hasFilters}
                                canCreate={canCreate}
                                onUpload={() => setUploadOpen(true)}
                                onClearFilters={() => {
                                    store.setSearch('');
                                    store.setKindFilter('all');
                                }}
                            />
                        ) : (
                            <MediaGrid
                                folders={store.childFolders}
                                assets={store.visibleAssets}
                                folderCounts={store.folderCounts}
                                selectedIds={store.selectedIds}
                                onOpenFolder={store.navigateTo}
                                onRenameFolder={handleRenameFolder}
                                onDeleteFolder={handleDeleteFolder}
                                onToggleSelect={store.toggleSelect}
                                onAssetAction={handleAssetAction}
                                canCreate={canCreate}
                                canUpdate={canUpdate}
                                canDelete={canDelete}
                            />
                        )}
                    </div>
                </main>
            </div>

            {/* Mobile-only folder navigation, mirroring the inline sidebar. */}
            <Drawer
                direction="left"
                open={navOpen}
                onOpenChange={setNavOpen}
                shouldScaleBackground={false}
            >
                <DrawerContent className="data-[vaul-drawer-direction=left]:w-72">
                    <DrawerTitle className="sr-only">
                        {intl.formatMessage(messages.navTitle)}
                    </DrawerTitle>
                    <MediaFoldersNav
                        className="w-full"
                        folders={store.folders}
                        currentFolderId={store.currentFolderId}
                        counts={store.folderCounts}
                        rootCount={store.folderCounts.get(ROOT_FOLDER_ID) ?? 0}
                        onNavigate={(folderId) => {
                            store.navigateTo(folderId);
                            setNavOpen(false);
                        }}
                        onNewFolder={() => {
                            setNavOpen(false);
                            setNewFolderOpen(true);
                        }}
                        canCreate={canCreate}
                    />
                </DrawerContent>
            </Drawer>

            <AssetDetailDrawer
                asset={store.detailAsset}
                locationLabel={locationLabel}
                onOpenChange={(open) => {
                    if (!open) store.closeDetail();
                }}
                onAction={handleAssetAction}
                canCreate={canCreate}
                canUpdate={canUpdate}
                canDelete={canDelete}
            />

            <NewFolderDialog
                open={newFolderOpen}
                onOpenChange={setNewFolderOpen}
                locationLabel={locationLabel}
                onCreate={(name) => {
                    store.createFolder(name);
                    toast.success(
                        intl.formatMessage(messages.tCreated, { name })
                    );
                }}
            />

            <UploadDialog
                open={uploadOpen}
                onOpenChange={setUploadOpen}
                locationLabel={locationLabel}
                // No toast here: the upload has only been *queued*. Progress and
                // the per-file outcome are the banner's job — a success toast
                // fired at submit time would claim a result nobody has yet.
                onUpload={store.uploadFiles}
            />

            <RenameDialog
                open={renameTarget !== null}
                onOpenChange={(open) => {
                    if (!open) setRenameTarget(null);
                }}
                currentName={renameTarget?.name ?? ''}
                onRename={submitRename}
            />

            <MoveAssetsDialog
                open={moveIds !== null}
                onOpenChange={(open) => {
                    if (!open) setMoveIds(null);
                }}
                folders={store.folders}
                count={moveIds?.length ?? 0}
                currentFolderId={store.currentFolderId}
                onMove={submitMove}
            />

            <ConfirmDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null);
                }}
                title={
                    deleteTarget?.kind === 'folder'
                        ? intl.formatMessage(messages.deleteFolderTitle, {
                              name: deleteTarget.folder.name
                          })
                        : intl.formatMessage(messages.deleteAssetsTitle, {
                              count:
                                  deleteTarget?.kind === 'assets'
                                      ? deleteTarget.ids.length
                                      : 0
                          })
                }
                description={
                    deleteTarget?.kind === 'folder'
                        ? intl.formatMessage(messages.deleteFolderBody)
                        : intl.formatMessage(messages.deleteAssetsBody)
                }
                confirmLabel={intl.formatMessage(messages.confirmDelete)}
                confirmVariant="destructive"
                onConfirm={confirmDelete}
            />
        </div>
    );
}
