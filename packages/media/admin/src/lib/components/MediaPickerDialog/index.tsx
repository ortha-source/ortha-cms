import { useMemo, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Check, Folder, Search } from 'lucide-react';
import {
    Badge,
    Button,
    cn,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Input
} from '@ortha-cms/design-system';
import { useMediaLibrary } from '../../hooks/useMediaLibrary';
import type { MediaAsset } from '../../types/mediaAsset';
import { acceptsAsset, type MediaAccept } from '../../utils/mediaAccept';
import { MediaThumbnail } from '../MediaThumbnail';

const messages = defineMessages({
    titleSingle: {
        id: 'media.picker.titleSingle',
        defaultMessage: 'Select an asset'
    },
    titleMultiple: {
        id: 'media.picker.titleMultiple',
        defaultMessage: 'Select assets'
    },
    description: {
        id: 'media.picker.description',
        defaultMessage: 'Choose from the Media Library, or upload from the field.'
    },
    search: { id: 'media.picker.search', defaultMessage: 'Search assets…' },
    root: { id: 'media.picker.root', defaultMessage: 'All media' },
    empty: {
        id: 'media.picker.empty',
        defaultMessage: 'No matching assets in this folder.'
    },
    loading: { id: 'media.picker.loading', defaultMessage: 'Loading assets…' },
    cancel: { id: 'media.picker.cancel', defaultMessage: 'Cancel' },
    confirm: { id: 'media.picker.confirm', defaultMessage: 'Add selected' },
    selected: { id: 'media.picker.selected', defaultMessage: '{count} selected' }
});

/**
 * A modal picker over the Media Library for a content record's media field.
 * Reuses {@link useMediaLibrary} for browsing (folders + search), narrows the
 * candidates to the field's `accept` restriction, and returns the chosen
 * asset(s). Single mode selects exactly one (confirming immediately on pick is
 * avoided so the user can preview); multiple accumulates a set. Fully
 * controlled — the caller owns the field value.
 */
export function MediaPickerDialog({
    open,
    onOpenChange,
    multiple,
    accept,
    onConfirm
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    multiple: boolean;
    accept?: MediaAccept;
    onConfirm: (assets: MediaAsset[]) => void;
}) {
    const intl = useIntl();
    const library = useMediaLibrary(open);
    const [picked, setPicked] = useState<Map<string, MediaAsset>>(new Map());

    // Candidates: the folder's search/kind-filtered assets, further restricted
    // to what the field accepts (the server enforces this too, on save).
    const candidates = useMemo(
        () => library.visibleAssets.filter((a) => acceptsAsset(accept, a)),
        [library.visibleAssets, accept]
    );

    const toggle = (asset: MediaAsset) => {
        setPicked((current) => {
            const next = new Map(multiple ? current : []);
            if (next.has(asset.id)) next.delete(asset.id);
            else next.set(asset.id, asset);
            return next;
        });
    };

    const close = () => {
        setPicked(new Map());
        onOpenChange(false);
    };

    const confirm = () => {
        onConfirm([...picked.values()]);
        close();
    };

    return (
        <Dialog open={open} onOpenChange={(next) => (next ? null : close())}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {intl.formatMessage(
                            multiple
                                ? messages.titleMultiple
                                : messages.titleSingle
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        {intl.formatMessage(messages.description)}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search
                            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden
                        />
                        <Input
                            value={library.search}
                            onChange={(e) => library.setSearch(e.target.value)}
                            placeholder={intl.formatMessage(messages.search)}
                            className="pl-8"
                            aria-label={intl.formatMessage(messages.search)}
                        />
                    </div>
                </div>

                {/* Folder navigation — click a child folder to descend. */}
                {library.childFolders.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                        {library.childFolders.map((folder) => (
                            <Button
                                key={folder.id}
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => library.navigateTo(folder.id)}
                            >
                                <Folder className="size-3.5" aria-hidden />
                                {folder.name}
                            </Button>
                        ))}
                    </div>
                ) : null}

                <div className="max-h-80 overflow-y-auto rounded-md border p-2">
                    {library.isLoading ? (
                        <p className="p-4 text-center text-sm text-muted-foreground">
                            {intl.formatMessage(messages.loading)}
                        </p>
                    ) : candidates.length === 0 ? (
                        <p className="p-4 text-center text-sm text-muted-foreground">
                            {intl.formatMessage(messages.empty)}
                        </p>
                    ) : (
                        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                            {candidates.map((asset) => {
                                const isPicked = picked.has(asset.id);
                                return (
                                    <li key={asset.id}>
                                        <button
                                            type="button"
                                            aria-pressed={isPicked}
                                            onClick={() => toggle(asset)}
                                            className={cn(
                                                'group relative block w-full overflow-hidden rounded-md border text-left transition',
                                                isPicked
                                                    ? 'border-primary ring-2 ring-primary'
                                                    : 'border-border hover:border-primary/50'
                                            )}
                                        >
                                            <MediaThumbnail
                                                asset={asset}
                                                className="aspect-square w-full"
                                            />
                                            {isPicked ? (
                                                <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                                                    <Check
                                                        className="size-3"
                                                        aria-hidden
                                                    />
                                                </span>
                                            ) : null}
                                            <span className="block truncate px-1.5 py-1 text-xs">
                                                {asset.name}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <DialogFooter className="items-center sm:justify-between">
                    {picked.size > 0 ? (
                        <Badge variant="secondary">
                            {intl.formatMessage(messages.selected, {
                                count: picked.size
                            })}
                        </Badge>
                    ) : (
                        <span />
                    )}
                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" onClick={close}>
                            {intl.formatMessage(messages.cancel)}
                        </Button>
                        <Button
                            type="button"
                            onClick={confirm}
                            disabled={picked.size === 0}
                        >
                            {intl.formatMessage(messages.confirm)}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
