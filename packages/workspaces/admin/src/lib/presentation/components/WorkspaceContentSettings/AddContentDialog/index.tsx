import { useEffect, useId, useMemo, useState } from 'react';
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
} from '@orthacms/design-system';
import type { ContentType } from '../../../../domain/types/wizard';
import { isPage } from '..';

const messages = defineMessages({
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
        defaultMessage:
            '{count, plural, =0 {Add} one {Add # type} other {Add # types}}'
    },
    ownGroup: {
        id: 'workspaces.settings.content.addDialog.ownGroup',
        defaultMessage: 'This workspace’s own records'
    },
    sharedGroup: {
        id: 'workspaces.settings.content.addDialog.sharedGroup',
        defaultMessage: 'From {workspace}'
    },
    sharedLabel: {
        id: 'workspaces.settings.content.sharedLabel',
        defaultMessage: '{type} · {workspace}'
    },
    sharedError: {
        id: 'workspaces.settings.content.addDialog.sharedError',
        defaultMessage:
            'Couldn’t load the shared workspaces, so only this workspace’s own types are listed.'
    }
});

/**
 * One grant the dialog can make: a type as this workspace's own records, or —
 * with `sourceWorkspaceId` — the records of that shared workspace.
 */
export type ContentGrantChoice = {
    /** The content-type slug. */
    slug: string;
    /** The shared workspace to grant it from; omitted for an own grant. */
    sourceWorkspaceId?: string;
};

/** The types one shared workspace offers, not yet granted (already one kind). */
export type SharedChoiceGroup = {
    /** The shared workspace's id. */
    workspaceId: string;
    /** Its display name — the group heading and the row suffix. */
    workspaceName: string;
    /** The grantable types, each with its display label and kind. */
    items: { slug: string; label: string; kind: 'collection' | 'single' }[];
};

/** A rendered row: its selection key, its label and its kind. */
type ChoiceRow = { key: string; label: string; isCollection: boolean };

/** Whether any of `fields` contains the (lower-cased) query; empty matches all. */
function matchesQuery(q: string, ...fields: (string | undefined)[]): boolean {
    return !q || fields.some((field) => field?.toLowerCase().includes(q));
}

/** Props for {@link AddContentDialog}. */
export type AddContentDialogProps = {
    /** Whether the dialog is open. */
    open: boolean;
    /** Open/close callback; ignored while saving. */
    onOpenChange: (open: boolean) => void;
    /** Localized dialog heading (e.g. "Add collections"). */
    title: string;
    /** Localized supporting copy. */
    description: string;
    /** Content types not yet granted — the selectable list (already one kind). */
    available: ContentType[];
    /**
     * Types shared workspaces offer that are not yet granted from them, one
     * group per source (already one kind). Empty when nothing is shared.
     */
    sharedGroups?: SharedChoiceGroup[];
    /** The shared-sources read failed — say so rather than list nothing. */
    sharedError?: boolean;
    /** Grants the chosen types; resolves when done so the dialog can close. */
    onConfirm: (choices: ContentGrantChoice[]) => Promise<void>;
    /** Whether a grant is in flight. */
    busy?: boolean;
};

/**
 * A search + multi-select dialog for granting content types of a **single kind**
 * (collections or pages — the caller pre-filters `available` and labels it via
 * `title`): type to filter, tick any number, then Add them in one go. Selection
 * + query reset each time the dialog opens.
 *
 * Besides this workspace's own types it lists what **shared workspaces** offer,
 * grouped "From {workspace}", each row "{Type} · {Workspace}" — a separate
 * grant from the own one, so the same type can appear in more than one group.
 */
export function AddContentDialog({
    open,
    onOpenChange,
    title,
    description,
    available,
    sharedGroups = [],
    sharedError = false,
    onConfirm,
    busy = false
}: AddContentDialogProps) {
    const intl = useIntl();
    const headingId = useId();
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());

    // Reset the query + selection whenever the dialog (re)opens.
    useEffect(() => {
        if (open) {
            setQuery('');
            setSelected(new Set());
        }
    }, [open]);

    const q = query.trim().toLowerCase();

    const ownRows = useMemo<ChoiceRow[]>(
        () =>
            available
                .filter((type) =>
                    matchesQuery(q, type.label, type.name, type.path)
                )
                .map((type) => ({
                    key: type.name,
                    label: type.label ?? type.name,
                    isCollection: !isPage(type)
                })),
        [available, q]
    );

    const sharedRows = useMemo(
        () =>
            sharedGroups
                .map((group) => ({
                    group,
                    rows: group.items
                        .filter((item) =>
                            matchesQuery(
                                q,
                                item.label,
                                item.slug,
                                group.workspaceName
                            )
                        )
                        .map(
                            (item): ChoiceRow => ({
                                key: `${item.slug}@${group.workspaceId}`,
                                label: intl.formatMessage(
                                    messages.sharedLabel,
                                    {
                                        type: item.label,
                                        workspace: group.workspaceName
                                    }
                                ),
                                isCollection: item.kind !== 'single'
                            })
                        )
                }))
                .filter(({ rows }) => rows.length > 0),
        [sharedGroups, q, intl]
    );

    const totalAvailable =
        available.length +
        sharedGroups.reduce((n, group) => n + group.items.length, 0);
    const totalShown =
        ownRows.length + sharedRows.reduce((n, { rows }) => n + rows.length, 0);
    // Group headings only earn their place once there is more than one
    // source to tell apart; a workspace with nothing shared sees the list it
    // always did.
    const grouped = sharedGroups.length > 0;

    const choiceByKey = useMemo(() => {
        const map = new Map<string, ContentGrantChoice>();
        for (const type of available) map.set(type.name, { slug: type.name });
        for (const group of sharedGroups) {
            for (const item of group.items) {
                map.set(`${item.slug}@${group.workspaceId}`, {
                    slug: item.slug,
                    sourceWorkspaceId: group.workspaceId
                });
            }
        }
        return map;
    }, [available, sharedGroups]);

    const toggle = (key: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const confirm = async () => {
        const choices = [...selected]
            .map((key) => choiceByKey.get(key))
            .filter((choice): choice is ContentGrantChoice => !!choice);
        if (choices.length === 0) return;
        await onConfirm(choices);
    };

    const renderRow = ({ key, label, isCollection }: ChoiceRow) => {
        return (
            <li key={key}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent">
                    <Checkbox
                        checked={selected.has(key)}
                        onCheckedChange={() => toggle(key)}
                    />
                    {isCollection ? (
                        <Layers
                            aria-hidden
                            className="size-4 shrink-0 text-muted-foreground"
                        />
                    ) : (
                        <FileText
                            aria-hidden
                            className="size-4 shrink-0 text-muted-foreground"
                        />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {label}
                    </span>
                    <Badge variant="secondary">
                        {intl.formatMessage(
                            isCollection ? messages.collection : messages.single
                        )}
                    </Badge>
                </label>
            </li>
        );
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
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
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
                        aria-label={intl.formatMessage(
                            messages.searchPlaceholder
                        )}
                        autoComplete="off"
                    />
                </InputGroup>

                {sharedError ? (
                    <p className="text-sm text-muted-foreground" role="status">
                        {intl.formatMessage(messages.sharedError)}
                    </p>
                ) : null}

                <div className="max-h-72 overflow-y-auto rounded-xl border">
                    {totalAvailable === 0 ? (
                        <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                            {intl.formatMessage(messages.allGranted)}
                        </p>
                    ) : totalShown === 0 ? (
                        <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                            {intl.formatMessage(messages.noMatches)}
                        </p>
                    ) : grouped ? (
                        <div className="flex flex-col">
                            {ownRows.length > 0 ? (
                                <div
                                    role="group"
                                    aria-labelledby={`${headingId}-own`}
                                >
                                    <h3
                                        id={`${headingId}-own`}
                                        className="px-3 pb-1 pt-3 text-xs font-medium text-muted-foreground"
                                    >
                                        {intl.formatMessage(messages.ownGroup)}
                                    </h3>
                                    <ul className="flex flex-col">
                                        {ownRows.map(renderRow)}
                                    </ul>
                                </div>
                            ) : null}
                            {sharedRows.map(({ group, rows }) => (
                                <div
                                    key={group.workspaceId}
                                    role="group"
                                    aria-labelledby={`${headingId}-${group.workspaceId}`}
                                >
                                    <h3
                                        id={`${headingId}-${group.workspaceId}`}
                                        className="px-3 pb-1 pt-3 text-xs font-medium text-muted-foreground"
                                    >
                                        {intl.formatMessage(
                                            messages.sharedGroup,
                                            { workspace: group.workspaceName }
                                        )}
                                    </h3>
                                    <ul className="flex flex-col">
                                        {rows.map(renderRow)}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <ul className="flex flex-col">
                            {ownRows.map(renderRow)}
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
