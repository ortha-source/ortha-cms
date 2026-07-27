import { useCallback, useMemo, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient
} from '@tanstack/react-query';
import { toast } from '@ortha-cms/design-system';
import { ApiError } from '@ortha-cms/utils-admin';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import {
    KIND_FILTER_ALL,
    MEDIA_SORT,
    ROOT_FOLDER_ID,
    type MediaKind,
    type MediaSort
} from '../../constants';
import type { MediaFolder } from '../../types/mediaFolder';
import { mediaKeys } from '../../infrastructure/mediaKeys';
import { httpMediaGateway } from '../../infrastructure/httpMediaGateway';
import { useUploadQueue } from '../useUploadQueue';

/** The selected kind filter — a {@link MediaKind} or the "all" sentinel. */
export type KindFilter = MediaKind | typeof KIND_FILTER_ALL;

/** Intl descriptor for a failed media mutation. */
const messages = defineMessages({
    error: {
        id: 'media.error.mutation',
        defaultMessage: 'Something went wrong. Please try again.'
    }
});

/**
 * The Media Library's data layer and every action the UI can take. Folders and
 * the open folder's assets are fetched from `@ortha-cms/media-server` via the
 * gateway (TanStack Query); mutations post to the API and invalidate the cache.
 * View/search/sort/filter/selection/navigation stay local UI state. The returned
 * shape mirrors the former mock store exactly, so no component changed.
 *
 * @param enabled - gates the reads (false until the caller confirms `media:read`).
 */
export function useMediaLibrary(enabled = true) {
    const intl = useIntl();
    const workspaceId = useCurrentWorkspace().id;
    const queryClient = useQueryClient();

    const [currentFolderId, setCurrentFolderId] = useState(ROOT_FOLDER_ID);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(
        () => new Set()
    );
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<MediaSort>(MEDIA_SORT.Newest);
    const [kindFilter, setKindFilter] = useState<KindFilter>(KIND_FILTER_ALL);
    const [detailAssetId, setDetailAssetId] = useState<string | null>(null);

    const foldersQuery = useQuery({
        queryKey: mediaKeys.folders(workspaceId),
        queryFn: () => httpMediaGateway.listFolders(),
        enabled
    });
    const assetsQuery = useQuery({
        queryKey: mediaKeys.assets(workspaceId, currentFolderId),
        queryFn: () => httpMediaGateway.listAssets(currentFolderId),
        placeholderData: keepPreviousData,
        enabled
    });

    const folders = useMemo(
        () => foldersQuery.data?.folders ?? [],
        [foldersQuery.data]
    );
    const assets = useMemo(() => assetsQuery.data ?? [], [assetsQuery.data]);
    const folderCounts = useMemo(
        () => foldersQuery.data?.folderCounts ?? new Map<string, number>(),
        [foldersQuery.data]
    );

    /** Refetch folders + the visible assets after any mutation. */
    const invalidate = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: mediaKeys.all(workspaceId) });
    }, [queryClient, workspaceId]);

    /** Surfaces a mutation failure and resyncs from the server. */
    const onError = useCallback(
        (error: unknown) => {
            const message =
                error instanceof ApiError && error.message
                    ? error.message
                    : intl.formatMessage(messages.error);
            toast.error(message);
            invalidate();
        },
        [intl, invalidate]
    );

    /** The open folder record, or `null` at the synthetic root. */
    const currentFolder = useMemo(
        () => folders.find((f) => f.id === currentFolderId) ?? null,
        [folders, currentFolderId]
    );

    /** Ancestor chain (root → current), used by the breadcrumbs. */
    const breadcrumbs = useMemo(() => {
        const chain: MediaFolder[] = [];
        let cursor = currentFolder;
        while (cursor) {
            chain.unshift(cursor);
            const parentId = cursor.parentId;
            cursor =
                parentId === ROOT_FOLDER_ID
                    ? null
                    : (folders.find((f) => f.id === parentId) ?? null);
        }
        return chain;
    }, [currentFolder, folders]);

    /** Folders directly inside the open folder. */
    const childFolders = useMemo(
        () =>
            folders
                .filter((f) => f.parentId === currentFolderId)
                .sort((a, b) => a.name.localeCompare(b.name)),
        [folders, currentFolderId]
    );

    /** Assets in the open folder, after search + kind filter + sort. */
    const visibleAssets = useMemo(() => {
        const term = search.trim().toLowerCase();
        const filtered = assets.filter((asset) => {
            if (asset.folderId !== currentFolderId) return false;
            if (kindFilter !== KIND_FILTER_ALL && asset.kind !== kindFilter) {
                return false;
            }
            if (!term) return true;
            return (
                asset.name.toLowerCase().includes(term) ||
                asset.tags.some((tag) => tag.toLowerCase().includes(term))
            );
        });
        const sorted = [...filtered];
        sorted.sort((a, b) => {
            switch (sort) {
                case MEDIA_SORT.NameAsc:
                    return a.name.localeCompare(b.name);
                case MEDIA_SORT.NameDesc:
                    return b.name.localeCompare(a.name);
                case MEDIA_SORT.Oldest:
                    return a.createdAt.localeCompare(b.createdAt);
                case MEDIA_SORT.Largest:
                    return b.size - a.size;
                case MEDIA_SORT.Smallest:
                    return a.size - b.size;
                case MEDIA_SORT.Newest:
                default:
                    return b.createdAt.localeCompare(a.createdAt);
            }
        });
        return sorted;
    }, [assets, currentFolderId, kindFilter, search, sort]);

    /** The asset backing the detail drawer, if open. */
    const detailAsset = useMemo(
        () => assets.find((a) => a.id === detailAssetId) ?? null,
        [assets, detailAssetId]
    );

    /** Currently selected assets (within the open folder). */
    const selectedAssets = useMemo(
        () => assets.filter((a) => selectedIds.has(a.id)),
        [assets, selectedIds]
    );

    const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

    /** Navigate into a folder (or root) and drop the current selection. */
    const navigateTo = useCallback(
        (folderId: string) => {
            setCurrentFolderId(folderId);
            clearSelection();
        },
        [clearSelection]
    );

    const toggleSelect = useCallback((id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const openDetail = useCallback((id: string) => setDetailAssetId(id), []);
    const closeDetail = useCallback(() => setDetailAssetId(null), []);

    // --- Mutations (post to the API, then invalidate the cache) ---------------

    const createFolderM = useMutation({
        mutationFn: httpMediaGateway.createFolder,
        onSuccess: invalidate,
        onError
    });
    const renameFolderM = useMutation({
        mutationFn: httpMediaGateway.renameFolder,
        onSuccess: invalidate,
        onError
    });
    const deleteFolderM = useMutation({
        mutationFn: httpMediaGateway.deleteFolder,
        onSuccess: invalidate,
        onError
    });
    const renameAssetM = useMutation({
        mutationFn: httpMediaGateway.renameAsset,
        onSuccess: invalidate,
        onError
    });
    const moveAssetsM = useMutation({
        mutationFn: httpMediaGateway.moveAssets,
        onSuccess: invalidate,
        onError
    });
    const duplicateAssetsM = useMutation({
        mutationFn: httpMediaGateway.duplicateAssets,
        onSuccess: invalidate,
        onError
    });
    const deleteAssetsM = useMutation({
        mutationFn: httpMediaGateway.deleteAssets,
        onSuccess: invalidate,
        onError
    });
    // Uploads don't go through `useMutation`: the banner needs per-file progress
    // and independent per-file failure, which a single mutation can't express.
    const uploads = useUploadQueue(currentFolderId, invalidate);

    const createFolder = useCallback(
        (name: string, parentId: string = currentFolderId) => {
            createFolderM.mutate({ name, parentId });
        },
        [createFolderM, currentFolderId]
    );
    const renameFolder = useCallback(
        (id: string, name: string) => renameFolderM.mutate({ id, name }),
        [renameFolderM]
    );
    const deleteFolder = useCallback(
        (id: string) => deleteFolderM.mutate(id),
        [deleteFolderM]
    );
    const renameAsset = useCallback(
        (id: string, name: string) => renameAssetM.mutate({ id, name }),
        [renameAssetM]
    );
    const moveAssets = useCallback(
        (ids: string[], folderId: string) => {
            moveAssetsM.mutate({ ids, folderId });
        },
        [moveAssetsM]
    );
    const duplicateAssets = useCallback(
        (ids: string[]) => duplicateAssetsM.mutate(ids),
        [duplicateAssetsM]
    );
    const deleteAssets = useCallback(
        (ids: string[]) => {
            deleteAssetsM.mutate(ids);
            // Drop them from the selection; the drawer closes on its own once the
            // refetch removes the row (detailAsset derives to null).
            setSelectedIds((prev) => {
                const next = new Set(prev);
                ids.forEach((id) => next.delete(id));
                return next;
            });
        },
        [deleteAssetsM]
    );
    const uploadFiles = uploads.enqueue;

    return {
        // data
        folders,
        assets,
        currentFolderId,
        currentFolder,
        breadcrumbs,
        childFolders,
        visibleAssets,
        folderCounts,
        // load state
        isLoading: foldersQuery.isPending || assetsQuery.isPending,
        isError: foldersQuery.isError || assetsQuery.isError,
        reload: invalidate,
        // selection
        selectedIds,
        selectedAssets,
        toggleSelect,
        clearSelection,
        // detail drawer
        detailAsset,
        openDetail,
        closeDetail,
        // browse controls
        search,
        setSearch,
        sort,
        setSort,
        kindFilter,
        setKindFilter,
        // navigation
        navigateTo,
        // mutations
        createFolder,
        renameFolder,
        renameAsset,
        deleteAssets,
        deleteFolder,
        duplicateAssets,
        moveAssets,
        uploadFiles,
        // upload queue (progress banner)
        uploadItems: uploads.items,
        uploadSummary: uploads.summary,
        retryUpload: uploads.retry,
        cancelUpload: uploads.cancel,
        dismissUploads: uploads.dismissSettled
    };
}

/** The full store + actions returned by {@link useMediaLibrary}. */
export type MediaLibraryStore = ReturnType<typeof useMediaLibrary>;
