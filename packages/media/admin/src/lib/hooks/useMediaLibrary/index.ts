import { useCallback, useMemo, useState } from 'react';
import {
    KIND_FILTER_ALL,
    MEDIA_SORT,
    MEDIA_VIEW,
    ROOT_FOLDER_ID,
    type MediaKind,
    type MediaSort,
    type MediaView
} from '../../constants';
import type { MediaAsset } from '../../types/mediaAsset';
import type { MediaFolder } from '../../types/mediaFolder';
import { kindFromMime } from '../../utils/kindFromMime';
import { MOCK_ASSETS, MOCK_FOLDERS } from '../../utils/mockMedia';

/** A picked file the mock uploader turns into an asset (a slice of `File`). */
export type UploadInput = {
    name: string;
    size: number;
    type: string;
};

/** The selected kind filter — a {@link MediaKind} or the "all" sentinel. */
export type KindFilter = MediaKind | typeof KIND_FILTER_ALL;

/** Generates a unique id for a folder/asset created during the session. */
function newId(prefix: string): string {
    const rand =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2);
    return `${prefix}-${rand}`;
}

/**
 * The Media Library's in-memory store and every action the UI can take against
 * it. This is a **mockup**: there is no server, so folders/assets start from the
 * seed data (`mockMedia`) and all mutations — create folder, upload, rename,
 * duplicate, move, delete — update local React state and are lost on reload.
 * The shape mirrors what a real data layer (per-hook `apiClient` queries +
 * mutations) would expose, so the page can be rewired to a media server without
 * touching the components.
 */
export function useMediaLibrary() {
    const [folders, setFolders] = useState<MediaFolder[]>(() => [
        ...MOCK_FOLDERS
    ]);
    const [assets, setAssets] = useState<MediaAsset[]>(() => [...MOCK_ASSETS]);
    const [currentFolderId, setCurrentFolderId] = useState(ROOT_FOLDER_ID);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(
        () => new Set()
    );
    const [view, setView] = useState<MediaView>(MEDIA_VIEW.Grid);
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<MediaSort>(MEDIA_SORT.Newest);
    const [kindFilter, setKindFilter] = useState<KindFilter>(KIND_FILTER_ALL);
    const [detailAssetId, setDetailAssetId] = useState<string | null>(null);

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

    /** Currently selected assets (may include ones filtered out of view). */
    const selectedAssets = useMemo(
        () => assets.filter((a) => selectedIds.has(a.id)),
        [assets, selectedIds]
    );

    /** Per-folder asset totals (recursive), for the tree + folder cards. */
    const folderCounts = useMemo(() => {
        const counts = new Map<string, number>();
        for (const asset of assets) {
            counts.set(asset.folderId, (counts.get(asset.folderId) ?? 0) + 1);
        }
        return counts;
    }, [assets]);

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

    /** Select every asset currently visible (respects search/filter). */
    const selectAllVisible = useCallback(() => {
        setSelectedIds(new Set(visibleAssets.map((a) => a.id)));
    }, [visibleAssets]);

    const openDetail = useCallback((id: string) => setDetailAssetId(id), []);
    const closeDetail = useCallback(() => setDetailAssetId(null), []);

    /** Create a folder inside the open folder (or a given parent). */
    const createFolder = useCallback(
        (name: string, parentId: string = currentFolderId) => {
            const folder: MediaFolder = {
                id: newId('folder'),
                name: name.trim(),
                parentId,
                createdAt: new Date().toISOString()
            };
            setFolders((prev) => [...prev, folder]);
            return folder;
        },
        [currentFolderId]
    );

    /** Rename a folder in place. */
    const renameFolder = useCallback((id: string, name: string) => {
        setFolders((prev) =>
            prev.map((f) => (f.id === id ? { ...f, name: name.trim() } : f))
        );
    }, []);

    /** Rename an asset in place, bumping its updated timestamp. */
    const renameAsset = useCallback((id: string, name: string) => {
        setAssets((prev) =>
            prev.map((a) =>
                a.id === id
                    ? {
                          ...a,
                          name: name.trim(),
                          updatedAt: new Date().toISOString()
                      }
                    : a
            )
        );
    }, []);

    /** Delete assets by id and drop them from the selection. */
    const deleteAssets = useCallback(
        (ids: string[]) => {
            const remove = new Set(ids);
            setAssets((prev) => prev.filter((a) => !remove.has(a.id)));
            setSelectedIds((prev) => {
                const next = new Set(prev);
                ids.forEach((id) => next.delete(id));
                return next;
            });
            if (detailAssetId && remove.has(detailAssetId)) {
                setDetailAssetId(null);
            }
        },
        [detailAssetId]
    );

    /** Delete a folder, its descendant folders, and every asset within. */
    const deleteFolder = useCallback((id: string) => {
        setFolders((prev) => {
            const doomed = new Set<string>([id]);
            let grew = true;
            while (grew) {
                grew = false;
                for (const folder of prev) {
                    if (
                        doomed.has(folder.parentId) &&
                        !doomed.has(folder.id)
                    ) {
                        doomed.add(folder.id);
                        grew = true;
                    }
                }
            }
            setAssets((assetsPrev) =>
                assetsPrev.filter((a) => !doomed.has(a.folderId))
            );
            return prev.filter((f) => !doomed.has(f.id));
        });
    }, []);

    /** Duplicate assets, appending " copy" to each name; returns new ids. */
    const duplicateAssets = useCallback((ids: string[]) => {
        const created: string[] = [];
        setAssets((prev) => {
            const clones = prev
                .filter((a) => ids.includes(a.id))
                .map((a) => {
                    const id = newId('asset');
                    created.push(id);
                    const dot = a.name.lastIndexOf('.');
                    const name =
                        dot > 0
                            ? `${a.name.slice(0, dot)} copy${a.name.slice(dot)}`
                            : `${a.name} copy`;
                    const now = new Date().toISOString();
                    return {
                        ...a,
                        id,
                        name,
                        createdAt: now,
                        updatedAt: now
                    };
                });
            return [...prev, ...clones];
        });
        return created;
    }, []);

    /** Move assets into a target folder. */
    const moveAssets = useCallback((ids: string[], folderId: string) => {
        const move = new Set(ids);
        setAssets((prev) =>
            prev.map((a) =>
                move.has(a.id)
                    ? {
                          ...a,
                          folderId,
                          updatedAt: new Date().toISOString()
                      }
                    : a
            )
        );
    }, []);

    /** Synthesize assets from picked files into the open folder; returns count. */
    const uploadFiles = useCallback(
        (files: UploadInput[]) => {
            if (files.length === 0) return 0;
            const now = new Date().toISOString();
            const created = files.map<MediaAsset>((file) => ({
                id: newId('asset'),
                name: file.name,
                kind: kindFromMime(file.type),
                mimeType: file.type || 'application/octet-stream',
                size: file.size,
                folderId: currentFolderId,
                tags: [],
                uploadedBy: 'You',
                createdAt: now,
                updatedAt: now
            }));
            setAssets((prev) => [...created, ...prev]);
            return created.length;
        },
        [currentFolderId]
    );

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
        // selection
        selectedIds,
        selectedAssets,
        toggleSelect,
        selectAllVisible,
        clearSelection,
        // detail drawer
        detailAsset,
        openDetail,
        closeDetail,
        // view controls
        view,
        setView,
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
        uploadFiles
    };
}

/** The full store + actions returned by {@link useMediaLibrary}. */
export type MediaLibraryStore = ReturnType<typeof useMediaLibrary>;
