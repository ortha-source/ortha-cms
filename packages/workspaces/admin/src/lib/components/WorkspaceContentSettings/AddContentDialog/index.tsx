import { useEffect, useMemo, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { FileText, Layers, Search } from 'lucide-react';
import {
    Badge,
    Button,
    Checkbox,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    Spinner
} from '@ortha-cms/design-system';
import type { ContentType } from '../../../types/wizard';

const messages = defineMessages({
    title: {
        id: 'workspaces.settings.content.addDialog.title',
        defaultMessage: 'Add content types'
    },
    description: {
        id: 'workspaces.settings.content.addDialog.description',
        defaultMessage:
            'Search and select the collections and pages to grant this workspace.'
    },
    searchPlaceholder: {
        id: 'workspaces.settings.content.addDialog.searchPlaceholder',
        defaultMessage: 'Search content types'
    },
    collection: {
        id: 'workspaces.settings.content.kindCollection',
        defaultMessage: 'Collection'
    },
    single: {
        id: 'workspaces.settings.content.kindSingle',
        defaultMessage: 'Page'
    },
    noMatches: {
        id: 'workspaces.settings.content.addDialog.noMatches',
        defaultMessage: 'No content types match your search.'
    },
    allGranted: {
        id: 'workspaces.settings.content.allGranted',
        defaultMessage: 'Every content type is already granted.'
    },
    cancel: {
        id: 'workspaces.settings.content.addDialog.cancel',
        defaultMessage: 'Cancel'
    },
    save: {
        id: 'workspaces.settings.content.addDialog.save',
        defaultMessage: '{count, plural, =0 {Add} one {Add # type} other {Add # types}}'
    }
});

/** Props for {@link AddContentDialog}. */
export type AddContentDialogProps = {
    /** Whether the dialog is open. */
    open: boolean;
    /** Open/close callback; ignored while saving. */
    onOpenChange: (open: boolean) => void;
    /** Content types not yet granted — the selectable list. */
    available: ContentType[];
    /** Grants the chosen slugs; resolves when done so the dialog can close. */
    onConfirm: (slugs: string[]) => Promise<void>;
    /** Whether a grant is in flight. */
    busy?: boolean;
};

/**
 * A search + multi-select dialog for granting content types: type to filter the
 * catalogue of ungranted collections/pages, tick any number, then Add them in
 * one go. Selection + query reset each time the dialog opens.
 */
export function AddContentDialog({
    open,
    onOpenChange,
    available,
    onConfirm,
    busy = false
}: AddContentDialogProps) {
    const intl = useIntl();
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());

    // Reset the query + selection whenever the dialog (re)opens.
    useEffect(() => {
        if (open) {
            setQuery('');
            setSelected(new Set());
        }
    }, [open]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return available;
        return available.filter((type) =>
            [type.label, type.name, type.path]
                .filter(Boolean)
                .some((field) => field?.toLowerCase().includes(q))
        );
    }, [available, query]);

    const toggle = (slug: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(slug)) next.delete(slug);
            else next.add(slug);
            return next;
        });
    };

    const confirm = async () => {
        if (selected.size === 0) return;
        await onConfirm([...selected]);
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!busy) onOpenChange(next);
            }}
        >
            <DialogContent className="gap-4">
                <DialogHeader>
                    <DialogTitle>
                        {intl.formatMessage(messages.title)}
                    </DialogTitle>
                    <DialogDescription>
                        {intl.formatMessage(messages.description)}
                    </DialogDescription>
                </DialogHeader>

                <InputGroup className="shadow-none">
                    <InputGroupAddon>
                        <Search />
                    </InputGroupAddon>
                    <InputGroupInput
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={intl.formatMessage(
                            messages.searchPlaceholder
                        )}
                        autoComplete="off"
                    />
                </InputGroup>

                <div className="max-h-72 overflow-y-auto rounded-xl border">
                    {available.length === 0 ? (
                        <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                            {intl.formatMessage(messages.allGranted)}
                        </p>
                    ) : filtered.length === 0 ? (
                        <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                            {intl.formatMessage(messages.noMatches)}
                        </p>
                    ) : (
                        <ul className="flex flex-col">
                            {filtered.map((type) => {
                                const isCollection = type.kind !== 'single';
                                const checked = selected.has(type.name);
                                return (
                                    <li key={type.name}>
                                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent">
                                            <Checkbox
                                                checked={checked}
                                                onCheckedChange={() =>
                                                    toggle(type.name)
                                                }
                                            />
                                            {isCollection ? (
                                                <Layers className="size-4 shrink-0 text-muted-foreground" />
                                            ) : (
                                                <FileText className="size-4 shrink-0 text-muted-foreground" />
                                            )}
                                            <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                                {type.label ?? type.name}
                                            </span>
                                            <Badge variant="secondary">
                                                {intl.formatMessage(
                                                    isCollection
                                                        ? messages.collection
                                                        : messages.single
                                                )}
                                            </Badge>
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={busy}
                    >
                        {intl.formatMessage(messages.cancel)}
                    </Button>
                    <Button
                        onClick={confirm}
                        disabled={busy || selected.size === 0}
                    >
                        {busy ? <Spinner /> : null}
                        {intl.formatMessage(messages.save, {
                            count: selected.size
                        })}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
